package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipEntry struct {
	count    int
	resetAt  time.Time
}

var (
	rateMu    sync.Mutex
	rateMap   = make(map[string]*ipEntry)
	rateLimit = 60        // requests per window
	rateWindow = time.Minute
)

// RateLimit provides a simple in-memory per-IP rate limiter.
// Returns 429 when the limit is exceeded.
func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		rateMu.Lock()
		now := time.Now()
		entry, exists := rateMap[ip]
		if !exists || now.After(entry.resetAt) {
			entry = &ipEntry{count: 0, resetAt: now.Add(rateWindow)}
			rateMap[ip] = entry
		}
		entry.count++
		exceeded := entry.count > rateLimit

		// Cleanup old entries periodically (every 1000 requests)
		if len(rateMap) > 1000 {
			for k, v := range rateMap {
				if now.After(v.resetAt) {
					delete(rateMap, k)
				}
			}
		}
		rateMu.Unlock()

		if exceeded {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, please try again later",
			})
			return
		}

		c.Next()
	}
}
