package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kumbi/backend/internal/auth"
	"github.com/kumbi/backend/internal/config"
	"github.com/kumbi/backend/internal/db"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}

	cfg, err := config.Load()
	if err != nil {
		fatal(err)
	}
	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer pool.Close()

	switch os.Args[1] {
	case "admin":
		// seed admin <email> <password>  — idempotent default admin
		if len(os.Args) < 4 {
			fmt.Fprintln(os.Stderr, "Usage: seed admin <email> <password>")
			os.Exit(1)
		}
		upsertUser(pool, "Admin", os.Args[2], os.Args[3], "admin")

	case "create-user":
		// create-user <name> <email> <password> [role]
		if len(os.Args) < 5 {
			fmt.Fprintln(os.Stderr, "Usage: seed create-user <name> <email> <password> [role]")
			os.Exit(1)
		}
		role := "admin"
		if len(os.Args) >= 6 {
			role = os.Args[5]
		}
		upsertUser(pool, os.Args[2], os.Args[3], os.Args[4], role)

	default:
		// legacy compat: seed <email> <password>
		if len(os.Args) < 3 {
			usage()
		}
		upsertUser(pool, "Admin", os.Args[1], os.Args[2], "admin")
	}
}

func upsertUser(pool *pgxpool.Pool, name, email, password, role string) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		fatal(err)
	}
	var id string
	err = pool.QueryRow(
		context.Background(),
		`INSERT INTO users (name, email, password, role)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (email) DO UPDATE SET name=$1, password=$3, role=$4
		 RETURNING id`,
		name, email, hash, role,
	).Scan(&id)
	if err != nil {
		fatal(err)
	}
	fmt.Printf("user upserted: %s (%s) role=%s id=%s\n", email, name, role, id)
}

func usage() {
	fmt.Fprintln(os.Stderr, "Usage:")
	fmt.Fprintln(os.Stderr, "  seed admin <email> <password>")
	fmt.Fprintln(os.Stderr, "  seed create-user <name> <email> <password> [role]")
	os.Exit(1)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}
