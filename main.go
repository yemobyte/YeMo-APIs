package main

import (
	"log"

	"yemo-api/pkg/server"
	"github.com/joho/godotenv"

	// Import endpoints to trigger init() and registration
	_ "yemo-api/api/downloader"
	_ "yemo-api/api/search"
	_ "yemo-api/api/tools"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	srv := server.New()
	srv.Init()
	srv.Start()
}
