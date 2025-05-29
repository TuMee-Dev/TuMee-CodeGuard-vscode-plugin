#!/usr/bin/env python3
"""
Language scope configuration loader for Python
This module loads the same language-scopes.json file used by the TypeScript extension
"""

import json
import os
from typing import Dict, List, Optional, Set


class LanguageScopeLoader:
    """Loads and resolves language scope configurations from JSON"""
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the loader with an optional custom config path
        
        Args:
            config_path: Path to language-scopes.json file. If None, uses default location.
        """
        if config_path is None:
            # Default to same directory as this script
            config_path = os.path.join(os.path.dirname(__file__), 'language-scopes.json')
        
        self.config_path = config_path
        self._config = None
        self._resolved_scopes = None
    
    def load_config(self) -> dict:
        """Load the configuration from JSON file"""
        if self._config is not None:
            return self._config
        
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self._config = json.load(f)
            return self._config
        except Exception as e:
            print(f"Failed to load language scopes configuration: {e}")
            # Return minimal fallback configuration
            return {
                "version": "1.0.0",
                "languages": {}
            }
    
    def resolve_language_scopes(self, lang_id: str, visited: Optional[Set[str]] = None) -> Dict[str, List[str]]:
        """
        Resolve scopes for a specific language, handling inheritance
        
        Args:
            lang_id: Language identifier (e.g., 'typescript', 'python')
            visited: Set of already visited languages (for circular dependency detection)
        
        Returns:
            Dictionary mapping scope names to lists of tree-sitter node types
        """
        if visited is None:
            visited = set()
        
        # Prevent circular dependencies
        if lang_id in visited:
            print(f"Warning: Circular dependency detected for language: {lang_id}")
            return {}
        
        visited.add(lang_id)
        
        config = self.load_config()
        languages = config.get('languages', {})
        
        if lang_id not in languages:
            return {}
        
        lang_config = languages[lang_id]
        scopes = {}
        
        # If this language extends another, get the parent scopes first
        if 'extends' in lang_config:
            parent_scopes = self.resolve_language_scopes(lang_config['extends'], visited)
            # Deep copy parent scopes
            for key, values in parent_scopes.items():
                scopes[key] = list(values)
        
        # Apply this language's scopes (merge with parent)
        if 'scopes' in lang_config:
            for key, values in lang_config['scopes'].items():
                if key in scopes:
                    # Merge with parent scope
                    scopes[key].extend(values)
                else:
                    # New scope
                    scopes[key] = list(values)
        
        return scopes
    
    def get_all_scopes(self) -> Dict[str, Dict[str, List[str]]]:
        """Get resolved scopes for all languages"""
        if self._resolved_scopes is not None:
            return self._resolved_scopes
        
        config = self.load_config()
        languages = config.get('languages', {})
        
        self._resolved_scopes = {}
        for lang_id in languages:
            self._resolved_scopes[lang_id] = self.resolve_language_scopes(lang_id)
        
        return self._resolved_scopes
    
    def get_language_scopes(self, lang_id: str) -> Optional[Dict[str, List[str]]]:
        """
        Get scope mappings for a specific language
        
        Args:
            lang_id: Language identifier
            
        Returns:
            Dictionary of scope mappings or None if language not supported
        """
        all_scopes = self.get_all_scopes()
        return all_scopes.get(lang_id)
    
    def is_node_type_in_scope(self, lang_id: str, node_type: str, scope: str) -> bool:
        """
        Check if a tree-sitter node type matches a semantic scope
        
        Args:
            lang_id: Language identifier
            node_type: Tree-sitter node type (e.g., 'function_declaration')
            scope: Semantic scope (e.g., 'func', 'class', 'block')
            
        Returns:
            True if the node type is in the specified scope
        """
        lang_scopes = self.get_language_scopes(lang_id)
        if not lang_scopes:
            return False
        
        scope_types = lang_scopes.get(scope, [])
        return node_type in scope_types


# Example usage
if __name__ == "__main__":
    # Create loader instance
    loader = LanguageScopeLoader()
    
    # Example 1: Get all scopes for TypeScript
    ts_scopes = loader.get_language_scopes('typescript')
    if ts_scopes:
        print("TypeScript function scopes:", ts_scopes.get('func', []))
        print("TypeScript class scopes:", ts_scopes.get('class', []))
    
    # Example 2: Check if a node type is a function in Python
    is_func = loader.is_node_type_in_scope('python', 'function_definition', 'func')
    print(f"Is 'function_definition' a function in Python? {is_func}")
    
    # Example 3: Show inheritance - TypeScript extends JavaScript
    js_scopes = loader.get_language_scopes('javascript')
    ts_scopes = loader.get_language_scopes('typescript')
    js_funcs = js_scopes.get('func', []) if js_scopes else []
    ts_funcs = ts_scopes.get('func', []) if ts_scopes else []
    print(f"JavaScript functions: {len(js_funcs)}")
    print(f"TypeScript functions: {len(ts_funcs)}")  # Should be more due to inheritance