// Types for the validation mode feature
// This feature allows the VSCode plugin to validate its guard region parsing
// against the CodeGuard command-line tool

export enum ValidationExitCode {
  Success = 0,                    // Perfect match
  ValidationMismatch = 1,         // Differences found
  ParsingError = 2,              // Tool couldn't parse file
  JsonError = 3,                 // Invalid JSON sent
  FileNotFound = 4,              // Source file not found
  FileChanged = 5,               // File modified since parse
  VersionIncompatible = 6,       // Version mismatch
  InternalError = 7              // Unexpected error
}

export enum ValidationStatus {
  Match = 'MATCH',
  Mismatch = 'MISMATCH',
  ErrorParsing = 'ERROR_PARSING',
  ErrorJson = 'ERROR_JSON',
  ErrorFileNotFound = 'ERROR_FILE_NOT_FOUND',
  ErrorFileChanged = 'ERROR_FILE_CHANGED',
  ErrorVersion = 'ERROR_VERSION',
  ErrorInternal = 'ERROR_INTERNAL'
}

export enum DiscrepancyType {
  BoundaryMismatch = 'boundary_mismatch',
  GuardMissing = 'guard_missing',
  GuardExtra = 'guard_extra',
  GuardInterpretation = 'guard_interpretation',
  PermissionMismatch = 'permission_mismatch',
  ScopeMismatch = 'scope_mismatch',
  TargetMismatch = 'target_mismatch',
  IdentifierMismatch = 'identifier_mismatch',
  LayerMismatch = 'layer_mismatch',
  EffectivePermissionMismatch = 'effective_permission_mismatch',
  ScopeBoundaryMismatch = 'scope_boundary_mismatch',
  InheritanceMismatch = 'inheritance_mismatch',
  OverrideMismatch = 'override_mismatch',
  ContentHashMismatch = 'content_hash_mismatch',
  LineCountMismatch = 'line_count_mismatch'
}

export interface ParsedGuard {
  raw: string;
  target: 'ai' | 'human' | 'all';
  identifiers: string[];
  permission: 'read-only' | 'write' | 'none';
  scope: 'file' | 'function' | 'class' | 'section' | 'block';
  scope_modifiers: string[];
}

export interface GuardRegion {
  index: number;
  guard: string;
  parsed_guard: ParsedGuard;
  declaration_line: number;
  start_line: number;
  end_line: number;
  content_hash: string;
  content_preview: string;
}

export interface LineCoverage {
  line: number;
  guards: number[]; // Array of guard region indices
}

export interface ValidationMetadata {
  parser_used: string;
  language: string;
  encoding: string;
  supports_overlapping: boolean;
}

export interface ValidationRequest {
  file_path: string;
  file_hash: string;
  total_lines: number;
  timestamp: string;
  plugin_version: string;
  plugin_name: string;
  guard_regions: GuardRegion[];
  line_coverage?: LineCoverage[];
  validation_metadata: ValidationMetadata;
}

export interface ValidationPackage {
  validation_request: ValidationRequest;
}

export interface GuardReference {
  index: number;
  guard: string;
  parsed: ParsedGuard;
  effective_permission?: string;
}

export interface Discrepancy {
  type: DiscrepancyType;
  severity: 'ERROR' | 'WARNING';
  line?: number;
  guard_index?: number;
  plugin_region?: GuardRegion;
  tool_region?: GuardRegion;
  plugin_guards?: GuardReference[];
  tool_guards?: GuardReference[];
  message: string;
}

export interface ValidationStatistics {
  total_lines: number;
  plugin_guard_regions: number;
  tool_guard_regions: number;
  matching_regions: number;
  max_overlapping_guards: number;
  lines_with_multiple_guards: number;
  discrepancy_count: number;
  affected_lines: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  status: ValidationStatus;
  exit_code: ValidationExitCode;
  file_path: string;
  timestamp: Date;
  tool_version?: string;
  plugin_version: string;
  discrepancies: Discrepancy[];
  statistics: ValidationStatistics;
  error_details?: ErrorDetails;
}

export interface VersionError {
  plugin_version: string;
  tool_version: string;
  minimum_version: string;
}