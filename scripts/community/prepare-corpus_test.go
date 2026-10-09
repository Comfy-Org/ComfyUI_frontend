package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Comfy-Org/cloud/services/ingest/workflowlibrary"
)

func TestReadCloudGraph(t *testing.T) {
	_, sourceFile, _, _ := runtime.Caller(0)
	fixture := filepath.Join(filepath.Dir(sourceFile), "../../src/platform/community/fixtures/cloud-reference-v1")
	source, err := os.ReadFile(filepath.Join(fixture, "import.json"))
	if err != nil {
		t.Fatal(err)
	}
	graph, err := os.ReadFile(filepath.Join(fixture, "workflow.cloud.json"))
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name      string
		field     string
		value     interface{}
		tamper    bool
		missing   bool
		ordinary  bool
		wantError bool
	}{
		{name: "valid producer adaptation"},
		{name: "substituted bytes", tamper: true, wantError: true},
		{name: "foreign original", field: "original_sha256", value: string(bytes.Repeat([]byte("a"), 64)), wantError: true},
		{name: "unsafe path", field: "workflow_file", value: "../workflow.cloud.json", wantError: true},
		{name: "missing digest", field: "workflow_sha256", value: "", wantError: true},
		{name: "execution claim", field: "execution_verified", value: true, wantError: true},
		{name: "missing file", missing: true, wantError: true},
		{name: "ordinary original", ordinary: true},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			metadata, err := workflowlibrary.NormalizeMetadata(string(source))
			if err != nil {
				t.Fatal(err)
			}
			if test.ordinary {
				delete(metadata.AdditionalProperties, "cloud_adaptation")
			} else if test.field != "" {
				encoded, err := json.Marshal(metadata.AdditionalProperties["cloud_adaptation"])
				if err != nil {
					t.Fatal(err)
				}
				ledger := map[string]interface{}{}
				if err := json.Unmarshal(encoded, &ledger); err != nil {
					t.Fatal(err)
				}
				ledger[test.field] = test.value
				metadata.AdditionalProperties["cloud_adaptation"] = ledger
			}
			var buffer bytes.Buffer
			writer := zip.NewWriter(&buffer)
			if !test.missing {
				member, err := writer.Create("fixture/workflow.cloud.json")
				if err != nil {
					t.Fatal(err)
				}
				body := graph
				if test.tamper {
					body = append(append([]byte{}, graph...), ' ')
				}
				if _, err := member.Write(body); err != nil {
					t.Fatal(err)
				}
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			archive, err := zip.NewReader(bytes.NewReader(buffer.Bytes()), int64(buffer.Len()))
			if err != nil {
				t.Fatal(err)
			}
			record := workflowlibrary.BundleRecord{Member: "fixture/import.json", Hash: metadata.WorkflowSha256}
			record.Request.Metadata = metadata
			actual, err := readCloudGraph(archive.File, record)
			if (err != nil) != test.wantError {
				t.Fatalf("error = %v, want error = %v", err, test.wantError)
			}
			if !test.wantError && !test.ordinary && !bytes.Equal(graph, actual) {
				t.Fatal("adapted bytes changed")
			}
			if test.ordinary && actual != nil {
				t.Fatal("ordinary graph gained adaptation")
			}
		})
	}
}
