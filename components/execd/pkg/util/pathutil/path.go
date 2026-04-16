// Copyright 2026 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pathutil

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var envVarPattern = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)`)

func validateEnvVars(path string) error {
	matches := envVarPattern.FindAllStringSubmatch(path, -1)
	if len(matches) == 0 {
		return nil
	}

	missingSet := make(map[string]struct{})
	for _, m := range matches {
		name := m[1]
		if name == "" {
			name = m[2]
		}
		if _, ok := os.LookupEnv(name); !ok {
			missingSet[name] = struct{}{}
		}
	}
	if len(missingSet) == 0 {
		return nil
	}

	missing := make([]string, 0, len(missingSet))
	for name := range missingSet {
		missing = append(missing, name)
	}
	sort.Strings(missing)
	return fmt.Errorf("path references undefined environment variables: %s", strings.Join(missing, ","))
}

// ExpandPath expands environment variables and a leading "~" to user home.
// It supports "~", "~/" and "~\" prefixes.
func ExpandPath(path string) (string, error) {
	if path == "" {
		return "", nil
	}
	if err := validateEnvVars(path); err != nil {
		return "", err
	}

	expanded := os.ExpandEnv(path)
	if expanded == "~" || strings.HasPrefix(expanded, "~/") || strings.HasPrefix(expanded, `~\`) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		if expanded == "~" {
			return home, nil
		}
		return filepath.Join(home, expanded[2:]), nil
	}

	return expanded, nil
}

func ExpandAbsPath(path string) (string, error) {
	expanded, err := ExpandPath(path)
	if err != nil {
		return "", err
	}
	return filepath.Abs(expanded)
}
