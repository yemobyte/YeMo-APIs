package search

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"yemo-api/pkg/loader"
	"yemo-api/pkg/response"
)

// PlayEndpoint implements the endpoint interface
type PlayEndpoint struct{}

func (e *PlayEndpoint) Name() string { return "Play & Download YouTube Video/Audio" }
func (e *PlayEndpoint) Description() string {
	return "Searches for a YouTube video, then provides download links for its MP3 and 480p MP4 formats."
}
func (e *PlayEndpoint) Category() string { return "Search" }
func (e *PlayEndpoint) Methods() []string { return []string{"GET"} }
func (e *PlayEndpoint) Params() []string { return []string{"query"} }
func (e *PlayEndpoint) ParamsSchema() map[string]interface{} {
	return map[string]interface{}{
		"query": map[string]interface{}{"type": "string", "required": true, "minLength": 1},
	}
}

// -- SaveTube Logic --

type saveTube struct {
	Base string
	CDN  string
	Info string
	DL   string
}

var st = saveTube{
	Base: "https://media.savetube.me/api",
	CDN:  "/random-cdn",
	Info: "/v2/info",
	DL:   "/download",
}

var stHeaders = map[string]string{
	"accept":       "*/*",
	"content-type": "application/json",
	"origin":       "https://yt.savetube.me",
	"referer":      "https://yt.savetube.me/",
	"user-agent":   "Postify/1.0.0",
}

func stRequest(method, endpoint string, data map[string]string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	targetURL := endpoint
	if !strings.HasPrefix(endpoint, "http") {
		targetURL = st.Base + endpoint
	}

	var body io.Reader
	if method == "POST" && data != nil {
		jsonData, _ := json.Marshal(data)
		body = bytes.NewBuffer(jsonData)
	}

	// For GET, we might append params?
	// The JS code: `params: method === 'get' ? data : undefined`
	if method == "GET" && data != nil && len(data) > 0 {
		// append query params
		u, _ := url.Parse(targetURL)
		q := u.Query()
		for k, v := range data {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
		targetURL = u.String()
	}

	req, err := http.NewRequest(method, targetURL, body)
	if err != nil {
		return nil, err
	}

	for k, v := range stHeaders {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func stGetCDN() (string, error) {
	res, err := stRequest("GET", st.CDN, nil)
	if err != nil {
		return "", err
	}
	if status, ok := res["status"].(bool); !ok || !status {
		return "", errors.New("failed to get CDN")
	}
	data, ok := res["data"].(map[string]interface{})
	if !ok {
		return "", errors.New("invalid CDN response format")
	}
	cdn, ok := data["cdn"].(string)
	if !ok {
		return "", errors.New("invalid CDN string")
	}
	return cdn, nil
}

func stDecrypt(enc string) (map[string]interface{}, error) {
	secretKey := "C5D58EF67A7584E4A29F6C35BBC4EB12"
	key, _ := hex.DecodeString(secretKey)

	data, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return nil, err
	}

	if len(data) < 16 {
		return nil, errors.New("data too short")
	}

	iv := data[:16]
	content := data[16:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	mode := cipher.NewCBCDecrypter(block, iv)
	decrypted := make([]byte, len(content))
	mode.CryptBlocks(decrypted, content)

	// Unpad (PKCS7)
	padding := int(decrypted[len(decrypted)-1])
	if padding > len(decrypted) || padding == 0 {
		return nil, errors.New("invalid padding")
	}
	decrypted = decrypted[:len(decrypted)-padding]

	var result map[string]interface{}
	if err := json.Unmarshal(decrypted, &result); err != nil {
		// Sometimes it returns a string that is JSON? Or direct JSON?
		// JS: JSON.parse(decrypted.toString())
		return nil, err
	}
	return result, nil
}

func extractVideoID(link string) string {
	// Simple regex
	patterns := []string{
		`youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})`,
		`youtu\.be\/([a-zA-Z0-9_-]{11})`,
		`youtube\.com\/v\/([a-zA-Z0-9_-]{11})`,
		`youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})`,
	}
	for _, p := range patterns {
		re := regexp.MustCompile(p)
		matches := re.FindStringSubmatch(link)
		if len(matches) > 1 {
			return matches[1]
		}
	}
	return ""
}

// ytmp3.mobi Logic
func ytmp3Mobi(youtubeURL string) (string, error) {
	videoID := extractVideoID(youtubeURL)
	if videoID == "" {
		return "", errors.New("invalid YouTube URL")
	}

	client := &http.Client{Timeout: 30 * time.Second}
	headers := map[string]string{"Referer": "https://id.ytmp3.mobi/"}

	fetchJSON := func(u string) (map[string]interface{}, error) {
		req, _ := http.NewRequest("GET", u, nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var res map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&res)
		return res, nil
	}

	randStr := fmt.Sprintf("%f", rand.Float64())

	// Init
	initURL := "https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=" + randStr
	initRes, err := fetchJSON(initURL)
	if err != nil {
		return "", err
	}

	convertURL, ok := initRes["convertURL"].(string)
	if !ok {
		return "", errors.New("failed to get convertURL")
	}

	// Trigger conversion
	params := url.Values{}
	params.Set("v", videoID)
	params.Set("f", "mp4")
	params.Set("_", fmt.Sprintf("%f", rand.Float64()))

	triggerURL := convertURL + "&" + params.Encode()
	convRes, err := fetchJSON(triggerURL)
	if err != nil {
		return "", err
	}

	downloadURL, _ := convRes["downloadURL"].(string)
	if downloadURL != "" {
		return downloadURL, nil
	}

	progressURL, ok := convRes["progressURL"].(string)
	if !ok {
		return "", errors.New("failed to get progressURL")
	}

	// Poll
	for i := 0; i < 10; i++ {
		progRes, err := fetchJSON(progressURL)
		if err != nil {
			return "", err
		}

		progress, _ := progRes["progress"].(float64)
		if progress == 3 {
			if dl, ok := progRes["downloadURL"].(string); ok {
				return dl, nil
			}
			// Should be in result
			return "", errors.New("progress complete but no url")
		}
		if msg, ok := progRes["error"].(string); ok && msg != "" {
			return "", errors.New("ytmp3 error: " + msg)
		}

		time.Sleep(1500 * time.Millisecond)
	}

	return "", errors.New("timeout")
}

func stDownload(link, format string) (map[string]interface{}, error) {
	id := extractVideoID(link)
	if id == "" {
		return nil, errors.New("failed to extract ID")
	}

	cdn, err := stGetCDN()
	if err != nil {
		return nil, err
	}

	// Info
	infoURL := fmt.Sprintf("https://%s%s", cdn, st.Info)
	infoRes, err := stRequest("POST", infoURL, map[string]string{"url": "https://www.youtube.com/watch?v=" + id})
	if err != nil {
		return nil, err
	}

	dataMap, ok := infoRes["data"].(map[string]interface{})
	if !ok {
		return nil, errors.New("invalid info response")
	}

	encData, ok := dataMap["data"].(string)
	if !ok {
		return nil, errors.New("invalid info data")
	}

	decrypted, err := stDecrypt(encData)
	if err != nil {
		return nil, err
	}

	var downloadLink string
	if format == "mp3" {
		key, ok := decrypted["key"].(string)
		if !ok {
			return nil, errors.New("missing key in decrypted data")
		}

		dlURL := fmt.Sprintf("https://%s%s", cdn, st.DL)
		dlRes, err := stRequest("POST", dlURL, map[string]string{
			"id":           id,
			"downloadType": "audio",
			"quality":      "128",
			"key":          key,
		})
		if err != nil {
			return nil, err
		}

		dMap, _ := dlRes["data"].(map[string]interface{})
		dData, _ := dMap["data"].(map[string]interface{})
		if url, ok := dData["downloadUrl"].(string); ok {
			downloadLink = url
		} else {
			return nil, errors.New("failed to get mp3 link")
		}
	} else if format == "480" {
		url, err := ytmp3Mobi(link)
		if err != nil {
			return nil, err
		}
		downloadLink = url
	} else {
		return nil, errors.New("unsupported format")
	}

	return map[string]interface{}{
		"title":     decrypted["title"],
		"thumbnail": decrypted["thumbnail"],
		"duration":  decrypted["duration"],
		"download":  downloadLink,
		"id":        id,
	}, nil
}

// Simple YouTube Search (Scraping)
func searchYouTube(query string) (string, string, error) {
	// If query is URL, just return it.
	if _, err := url.ParseRequestURI(query); err == nil && strings.Contains(query, "youtu") {
		return query, "", nil
	}

	// Fetch search page
	client := &http.Client{}
	req, _ := http.NewRequest("GET", "https://www.youtube.com/results?search_query="+url.QueryEscape(query), nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	content := string(body)

	re := regexp.MustCompile(`"videoId":"([a-zA-Z0-9_-]{11})"`)
	match := re.FindStringSubmatch(content)
	if len(match) > 1 {
		return "https://www.youtube.com/watch?v=" + match[1], match[1], nil
	}

	return "", "", errors.New("no video found")
}

func (e *PlayEndpoint) Run(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		response.Error(w, 400, "Parameter 'query' is required.")
		return
	}

	// Search or use URL
	videoURL, _, err := searchYouTube(query)
	if err != nil {
		response.Error(w, 404, "Video not found for the given query.")
		return
	}

	// Parallel download info fetching
	type resChan struct {
		format string
		res    map[string]interface{}
		err    error
	}
	ch := make(chan resChan, 2)

	go func() {
		r, e := stDownload(videoURL, "mp3")
		ch <- resChan{"mp3", r, e}
	}()
	go func() {
		r, e := stDownload(videoURL, "480")
		ch <- resChan{"480", r, e}
	}()

	var mp3Result, mp4Result map[string]interface{}
	var errs []string

	for i := 0; i < 2; i++ {
		r := <-ch
		if r.err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", r.format, r.err))
		} else {
			if r.format == "mp3" {
				mp3Result = r.res
			} else {
				mp4Result = r.res
			}
		}
	}

	if mp3Result == nil && mp4Result == nil {
		response.Error(w, 500, "Failed to fetch download links: "+strings.Join(errs, "; "))
		return
	}

	// Merge metadata from successful one
	meta := mp4Result
	if meta == nil {
		meta = mp3Result
	}

	data := map[string]interface{}{
		"dl_mp3": nil,
		"dl_mp4": nil,
		"metadata": map[string]interface{}{
			"title":     meta["title"],
			"thumbnail": meta["thumbnail"],
			"duration":  meta["duration"],
			"id":        meta["id"],
		},
	}

	if mp3Result != nil {
		data["dl_mp3"] = mp3Result["download"]
	}
	if mp4Result != nil {
		data["dl_mp4"] = mp4Result["download"]
	}

	response.JSON(w, 200, map[string]interface{}{
		"success": true,
		"creator": "GIMI❤️",
		"data":    data,
	})
}

func init() {
	loader.Register(&PlayEndpoint{})
}
