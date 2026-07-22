import { v4 as uuidv4 } from 'uuid';
import {
  RepositoryTree,
  PartialAnalysisResult,
  Component,
  ApiCallRecord,
} from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 5 of the analysis pipeline — React Component Extraction.
 *
 * Detects functional components (arrow functions and function declarations)
 * and class components extending React.Component in JSX/TSX files.
 *
 * Satisfies Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class ReactComponentAnalyzer implements Analyzer {
  readonly name = 'ReactComponentAnalyzer';

  /**
   * Active when JSX or TSX files exist in the repository.
   */
  detect(repo: RepositoryTree): boolean {
    return repo.files.some(
      (f) => f.extension === '.jsx' || f.extension === '.tsx',
    );
  }

  async analyze(repo: RepositoryTree): Promise<PartialAnalysisResult> {
    const jsxFiles = repo.files.filter(
      (f) => f.extension === '.jsx' || f.extension === '.tsx',
    );

    const componentMap = new Map<string, Component>();

    for (const file of jsxFiles) {
      const extracted = this._extractComponents(file.content, file.relativePath);
      for (const comp of extracted) {
        componentMap.set(comp.id, comp);
      }
    }

    // Build parent-child relationships based on imports
    this._buildRelationships(componentMap, jsxFiles, repo);

    return { components: Array.from(componentMap.values()) };
  }

  // ---------------------------------------------------------------------------
  // Component extraction
  // ---------------------------------------------------------------------------

  private _extractComponents(content: string, relativePath: string): Component[] {
    const components: Component[] = [];

    // Detect exported functional components via arrow functions:
    // export const Name = (...) => { ... }
    // export const Name: React.FC = (...) => { ... }
    const arrowFnPattern = /export\s+(?:default\s+)?(?:const|let|var)\s+([A-Z][A-Za-z0-9]*)\s*(?::\s*[^=]+)?\s*=\s*(?:\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?\s*=>/g;
    let match: RegExpExecArray | null;
    while ((match = arrowFnPattern.exec(content)) !== null) {
      const name = match[1];
      if (!this._isDuplicateName(components, name)) {
        components.push(this._buildComponent(name, relativePath, 'functional', content));
      }
    }

    // Detect exported functional components via function declarations:
    // export function Name(...) { ... }
    // export default function Name(...) { ... }
    const functionDeclPattern = /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9]*)\s*\(/g;
    while ((match = functionDeclPattern.exec(content)) !== null) {
      const name = match[1];
      if (!this._isDuplicateName(components, name)) {
        components.push(this._buildComponent(name, relativePath, 'functional', content));
      }
    }

    // Detect class components:
    // export class Name extends React.Component { ... }
    // export class Name extends Component { ... }
    const classPattern = /export\s+(?:default\s+)?class\s+([A-Z][A-Za-z0-9]*)\s+extends\s+(?:React\.)?Component/g;
    while ((match = classPattern.exec(content)) !== null) {
      const name = match[1];
      if (!this._isDuplicateName(components, name)) {
        components.push(this._buildComponent(name, relativePath, 'class', content));
      }
    }

    return components;
  }

  private _buildComponent(
    name: string,
    filePath: string,
    type: 'functional' | 'class',
    content: string,
  ): Component {
    const apiCalls = this._extractApiCalls(content);
    return {
      id: uuidv4(),
      name,
      filePath,
      type,
      apiCalls,
      children: [],
      parents: [],
    };
  }

  // ---------------------------------------------------------------------------
  // API call extraction
  // ---------------------------------------------------------------------------

  private _extractApiCalls(content: string): ApiCallRecord[] {
    const apiCalls: ApiCallRecord[] = [];
    const seenUrls = new Set<string>();

    // Match fetch('url') or fetch("url") or fetch(`url`)
    const fetchPattern = /fetch\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g;
    let match: RegExpExecArray | null;
    while ((match = fetchPattern.exec(content)) !== null) {
      const url = match[1] ?? match[2] ?? match[3];
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        apiCalls.push({ url, method: null });
      }
    }

    // Match axios.get('url'), axios.post('url'), etc.
    const axiosMethodPattern = /axios\s*\.\s*(get|post|put|patch|delete|head|options|request)\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/gi;
    while ((match = axiosMethodPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const url = match[2] ?? match[3] ?? match[4];
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        apiCalls.push({ url, method });
      }
    }

    // Match axios('url') or axios("url") direct calls
    const axiosDirectPattern = /axios\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/g;
    while ((match = axiosDirectPattern.exec(content)) !== null) {
      const url = match[1] ?? match[2] ?? match[3];
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        apiCalls.push({ url, method: null });
      }
    }

    return apiCalls;
  }

  // ---------------------------------------------------------------------------
  // Parent-child relationship building
  // ---------------------------------------------------------------------------

  private _buildRelationships(
    componentMap: Map<string, Component>,
    jsxFiles: { relativePath: string; content: string }[],
    repo: RepositoryTree,
  ): void {
    // Build a lookup: component name → component ID
    const nameToId = new Map<string, string>();
    for (const comp of componentMap.values()) {
      nameToId.set(comp.name, comp.id);
    }

    // For each component file, find import statements referencing other component files
    for (const comp of componentMap.values()) {
      const file = jsxFiles.find((f) => f.relativePath === comp.filePath);
      if (!file) continue;

      const importedNames = this._extractImportedComponentNames(file.content, nameToId);
      for (const childName of importedNames) {
        const childId = nameToId.get(childName);
        if (childId && childId !== comp.id) {
          // Parent (current component) → Child (imported component)
          if (!comp.children.includes(childId)) {
            comp.children.push(childId);
          }
          const child = componentMap.get(childId);
          if (child && !child.parents.includes(comp.id)) {
            child.parents.push(comp.id);
          }
        }
      }
    }
  }

  /**
   * Extract component names from import statements that reference known components.
   */
  private _extractImportedComponentNames(
    content: string,
    nameToId: Map<string, string>,
  ): string[] {
    const importedNames: string[] = [];
    // Match: import { Name, Name2 } from '...'
    // Match: import Name from '...'
    const importPattern = /import\s+(?:\{([^}]+)\}|([A-Z][A-Za-z0-9]*))\s+from\s+['"][^'"]+['"]/g;

    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      if (match[1]) {
        // Named imports: { Name1, Name2 }
        const names = match[1].split(',').map((s) => s.trim()).filter(Boolean);
        for (const name of names) {
          // Handle aliased imports: Name as Alias
          const actualName = name.split(/\s+as\s+/)[0].trim();
          if (nameToId.has(actualName)) {
            importedNames.push(actualName);
          }
        }
      } else if (match[2]) {
        // Default import: import Name from '...'
        if (nameToId.has(match[2])) {
          importedNames.push(match[2]);
        }
      }
    }

    return importedNames;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _isDuplicateName(components: Component[], name: string): boolean {
    return components.some((c) => c.name === name);
  }
}
