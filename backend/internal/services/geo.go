package services

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/oschwald/geoip2-golang"
)

// GeoService handles IP geolocation lookups.
type GeoService struct {
	db      *geoip2.Reader
	mu      sync.RWMutex
	_cache  map[string]*GeoResult
	cacheTTL time.Duration
}

type GeoResult struct {
	Country     string `json:"country"`
	CountryCode string `json:"countryCode"`
	City        string `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	ISP         string `json:"isp"`
}

func NewGeoService(dbPath string) (*GeoService, error) {
	db, err := geoip2.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("open geoip db: %w", err)
	}
	return &GeoService{
		db:       db,
		_cache:   make(map[string]*GeoResult),
		cacheTTL: 5 * time.Minute,
	}, nil
}

func (s *GeoService) Lookup(ipStr string) (*GeoResult, error) {
	if s == nil {
		return nil, fmt.Errorf("geo service not initialized (GeoLite2 db missing)")
	}
	s.mu.RLock()
	if cached, ok := s._cache[ipStr]; ok {
		s.mu.RUnlock()
		return cached, nil
	}
	s.mu.RUnlock()

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return nil, fmt.Errorf("invalid IP: %s", ipStr)
	}

	record, err := s.db.City(ip)
	if err != nil {
		return nil, fmt.Errorf("geoip lookup: %w", err)
	}

	result := &GeoResult{
		Country:     record.Country.Names["en"],
		CountryCode: record.Country.IsoCode,
		City:        record.City.Names["en"],
		Latitude:    record.Location.Latitude,
		Longitude:   record.Location.Longitude,
	}

	s.mu.Lock()
	s._cache[ipStr] = result
	s.mu.Unlock()

	return result, nil
}

func (s *GeoService) Close() {
	if s.db != nil {
		s.db.Close()
	}
}

// GetISP performs a reverse DNS lookup to determine the ISP/hosting provider.
func GetISP(ipStr string) string {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return "Unknown"
	}

	names, err := net.LookupAddr(ipStr)
	if err != nil || len(names) == 0 {
		return "Unknown"
	}

	// Return the first reverse DNS entry as ISP indicator
	return names[0]
}
