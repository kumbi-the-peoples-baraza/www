package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Logger(log zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Msg("request")
	}
}

func Recovery(log zerolog.Logger) gin.HandlerFunc {
	return gin.RecoveryWithWriter(nil, func(c *gin.Context, err interface{}) {
		log.Error().Interface("error", err).Msg("panic recovered")
		c.AbortWithStatusJSON(500, gin.H{"error": "internal server error"})
	})
}
