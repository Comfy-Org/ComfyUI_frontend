package main

import (
	"archive/zip"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/Comfy-Org/cloud/services/ingest/workflowlibrary"
)

func main() {
	bundle := flag.String("bundle", "", "Reviewed HARVEY ZIP")
	archiveSHA := flag.String("sha256", "", "Expected archive SHA256")
	manifestSHA := flag.String("manifest-sha256", "", "Expected manifest SHA256")
	output := flag.String("output", "", "New QA asset directory")
	flag.Parse()
	if err := prepare(*bundle, *archiveSHA, *manifestSHA, *output); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func prepare(bundle, archiveSHA, manifestSHA, output string) error {
	records, err := workflowlibrary.ReadBundle(bundle, archiveSHA, manifestSHA)
	if err != nil {
		return err
	}
	if output == "" {
		return fmt.Errorf("output directory required")
	}
	archive, err := zip.OpenReader(bundle)
	if err != nil {
		return err
	}
	defer archive.Close()
	cloudGraphs := map[string][]byte{}
	for _, record := range records {
		graph, err := readCloudGraph(archive.File, record)
		if err != nil {
			return err
		}
		if graph != nil {
			cloudGraphs[record.Hash] = graph
		}
	}
	if err := os.Mkdir(output, 0755); err != nil {
		return err
	}
	entries := make([]map[string]interface{}, 0, len(records))
	for _, record := range records {
		validated, err := workflowlibrary.Validate(record.Hash, record.Request)
		if err != nil {
			return err
		}
		metadata := record.Request.Metadata
		summary := map[string]interface{}{
			"workflow_sha256":       record.Hash,
			"metadata_sha256":       validated.Digest,
			"name":                  metadata.Name,
			"description":           metadata.Description,
			"tags":                  metadata.Tags,
			"tasks":                 metadata.Tasks,
			"structural_cluster":    metadata.StructuralCluster,
			"node_count":            validated.Nodes,
			"unresolved_pack_count": validated.Unresolved,
			"verified":              false,
		}
		entry := map[string]interface{}{}
		for key, value := range summary {
			entry[key] = value
		}
		entry["packs"], entry["models"], entry["node_types"] = validated.Packs, validated.Models, metadata.NodeTypes
		entries = append(entries, entry)
		directory := filepath.Join(output, record.Hash)
		if err := os.Mkdir(directory, 0755); err != nil {
			return err
		}
		source := *record.Request.SourceMetadataJson
		detail := map[string]interface{}{
			"summary":                summary,
			"metadata":               metadata,
			"source_metadata_json":   source,
			"source_metadata_sha256": workflowlibrary.Digest([]byte(source)),
		}
		if err := writeJSON(filepath.Join(directory, "detail.json"), detail); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(directory, "workflow.json"), []byte(record.Request.WorkflowJson), 0644); err != nil {
			return err
		}
		if graph := cloudGraphs[record.Hash]; graph != nil {
			if err := os.WriteFile(filepath.Join(directory, "workflow.cloud.json"), graph, 0644); err != nil {
				return err
			}
		}
	}
	if err := writeJSON(filepath.Join(output, "index.json"), map[string]interface{}{
		"archive_sha256": archiveSHA, "manifest_sha256": manifestSHA, "entries": entries,
	}); err != nil {
		return err
	}
	fmt.Printf("Prepared %d originals and %d adapted graphs; original graph and source metadata bytes retained\n", len(records), len(cloudGraphs))
	return nil
}

func readCloudGraph(files []*zip.File, record workflowlibrary.BundleRecord) ([]byte, error) {
	extension := record.Request.Metadata.AdditionalProperties["cloud_adaptation"]
	if extension == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(extension)
	if err != nil {
		return nil, err
	}
	var ledger struct {
		Version           string            `json:"version"`
		OriginalSHA       string            `json:"original_sha256"`
		File              string            `json:"workflow_file"`
		SHA               string            `json:"workflow_sha256"`
		ExecutionVerified *bool             `json:"execution_verified"`
		Changes           []json.RawMessage `json:"changes"`
	}
	if json.Unmarshal(encoded, &ledger) != nil {
		return nil, fmt.Errorf("invalid adaptation metadata: %s", record.Hash)
	}
	if ledger.File == "" && ledger.SHA == "" {
		return nil, nil
	}
	if ledger.Version != "cloud-reference-adaptation-v1" || ledger.OriginalSHA != record.Hash || ledger.File != "workflow.cloud.json" || !workflowlibrary.ValidHash(ledger.SHA) || ledger.ExecutionVerified == nil || *ledger.ExecutionVerified || len(ledger.Changes) == 0 {
		return nil, fmt.Errorf("invalid adaptation binding: %s", record.Hash)
	}
	name := strings.TrimSuffix(record.Member, "import.json") + ledger.File
	for _, file := range files {
		if file.Name != name {
			continue
		}
		if file.UncompressedSize64 > workflowlibrary.MaxWorkflowBytes {
			return nil, fmt.Errorf("adapted graph too large: %s", record.Hash)
		}
		reader, err := file.Open()
		if err != nil {
			return nil, err
		}
		defer reader.Close()
		raw, err := io.ReadAll(io.LimitReader(reader, workflowlibrary.MaxWorkflowBytes+1))
		if err != nil || len(raw) > workflowlibrary.MaxWorkflowBytes || workflowlibrary.Digest(raw) != ledger.SHA || !utf8.Valid(raw) || !json.Valid(raw) {
			return nil, fmt.Errorf("adapted graph checksum/format mismatch: %s", record.Hash)
		}
		return raw, nil
	}
	return nil, fmt.Errorf("adapted graph missing: %s", record.Hash)
}

func writeJSON(path string, value interface{}) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return os.WriteFile(path, encoded, 0644)
}
