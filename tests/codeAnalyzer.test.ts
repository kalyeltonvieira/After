import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSource } from "../server/services/codeAnalyzer.js";

test("AST parses TS/TSX symbols, imports, calls, and exports", () => {
  const tsCode = `
import { useState } from 'react';
import { fetchUser } from './api';

export interface UserProps {
  id: string;
}

export function UserProfile({ id }: UserProps) {
  const [data, setData] = useState(null);
  fetchUser(id);
  return null;
}
`;
  const result = analyzeSource("src/components/UserProfile.tsx", tsCode);
  assert.equal(result.parser, "typescript");
  assert.equal(result.certainty, "KNOWN");
  assert.ok(result.symbols.some((s) => s.name === "UserProfile" && s.type === "component"));
  assert.ok(result.symbols.some((s) => s.name === "UserProps" && s.type === "interface"));
  assert.ok(result.imports.some((i) => i.specifier === "react"));
  assert.ok(result.imports.some((i) => i.specifier === "./api"));
  assert.ok(result.exports.includes("UserProfile"));
});

test("AST parses Python definitions and imports", () => {
  const pyCode = `
from os import path
import requests

class DataIngestion:
    def __init__(self):
        pass

def process_batch(items):
    return len(items)
`;
  const result = analyzeSource("ingest.py", pyCode);
  assert.equal(result.parser, "python");
  assert.equal(result.certainty, "KNOWN");
  assert.ok(result.symbols.some((s) => s.name === "DataIngestion" && s.type === "class"));
  assert.ok(result.symbols.some((s) => s.name === "process_batch" && s.type === "function"));
  assert.ok(result.imports.some((i) => i.specifier === "os"));
  assert.ok(result.imports.some((i) => i.specifier === "requests"));
  assert.ok(result.exports.includes("DataIngestion"));
  assert.ok(result.exports.includes("process_batch"));
});

test("AST parses Go functions, structs, and imports", () => {
  const goCode = `
package main

import (
  "fmt"
  "net/http"
)

type ServerConfig struct {
  Port int
}

func StartServer(cfg ServerConfig) {
  fmt.Println(cfg.Port)
}
`;
  const result = analyzeSource("main.go", goCode);
  assert.equal(result.parser, "go");
  assert.equal(result.certainty, "KNOWN");
  assert.ok(result.symbols.some((s) => s.name === "StartServer" && s.type === "function" && s.exported));
  assert.ok(result.symbols.some((s) => s.name === "ServerConfig" && s.type === "class" && s.exported));
  assert.ok(result.imports.some((i) => i.specifier === "fmt"));
  assert.ok(result.imports.some((i) => i.specifier === "net/http"));
  assert.ok(result.exports.includes("StartServer"));
});