package main

import (
	"context"
	"fmt"
	"os"

	"github.com/kumbi/backend/internal/auth"
	"github.com/kumbi/backend/internal/config"
	"github.com/kumbi/backend/internal/db"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: seed <email> <password>")
		os.Exit(1)
	}
	email, password := os.Args[1], os.Args[2]

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	hash, err := auth.HashPassword(password)
	if err != nil {
		panic(err)
	}

	var id string
	err = pool.QueryRow(
		context.Background(),
		`INSERT INTO users (name, email, password, role) VALUES ('Admin', $1, $2, 'admin') ON CONFLICT (email) DO UPDATE SET password=$2 RETURNING id`,
		email,
		hash,
	).Scan(&id)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Admin user created: %s (id: %s)\n", email, id)
}
