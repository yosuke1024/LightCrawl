export interface TableCellRequirement {
  rowName: string;
  columnName: string;
  value: string;
}

export interface RetentionResult {
  factRetentionRate: number;
  codeRetentionRate: number;
  headingRetentionRate: number;
  tableCellRetentionRate: number;
  linkTargetRetentionRate: number;

  totalRequiredFacts: number;
  foundFacts: number;
  totalRequiredCodeFragments: number;
  foundCodeFragments: number;
  totalRequiredHeadings: number;
  foundHeadings: number;
  totalRequiredTableCells: number;
  foundTableCells: number;
  totalRequiredLinks: number;
  foundLinks: number;
}

function calculateRate(found: number, total: number): number {
  if (total === 0) return 1;
  if (found > total) return 1;
  return found / total;
}

function normalizeText(t: string): string {
  let normalized = t.normalize('NFKC');
  normalized = normalized.replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, '$1');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function countOccurrences(text: string, queries: string[]): number {
  const uniqueQueries = Array.from(new Set(queries));
  if (uniqueQueries.length === 0) return 0;
  
  const normalizedText = normalizeText(text);
  
  let found = 0;
  for (const query of uniqueQueries) {
    const normalizedQuery = normalizeText(query);
    if (normalizedText.includes(normalizedQuery)) {
      found++;
    }
  }
  return found;
}

function evaluateTableCells(text: string, requiredCells: TableCellRequirement[]): number {
  if (!requiredCells || requiredCells.length === 0) return 0;
  
  const lines = text.split('\n');
  let currentHeaders: string[] = [];
  let found = 0;
  let inTable = false;

  for (const req of requiredCells) {
    let cellFound = false;
    currentHeaders = [];
    inTable = false;

    const normRowName = normalizeText(req.rowName);
    const normColName = normalizeText(req.columnName);
    const normValue = normalizeText(req.value);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').map(c => normalizeText(c)).slice(1, -1);
        
        if (!inTable) {
          // Assume first line of table is header
          currentHeaders = cells;
          inTable = true;
          // Skip divider row (usually |---|---|)
        } else if (line.match(/^\|(?:[\s\-:]+\|)+$/)) {
          continue;
        } else {
          // Data row
          // Find if this row matches rowName
          const isTargetRow = cells.some(c => c.includes(normRowName));
          if (isTargetRow) {
            // Find column index
            const colIndex = currentHeaders.findIndex(h => h.includes(normColName));
            if (colIndex !== -1 && colIndex < cells.length) {
              // We should not match "3" in "30". Let's do a strict boundary check or exact match
              const cellValue = cells[colIndex];
              // Escape regex characters
              const escapedNormValue = normValue.replace(/[.*+?^$\/{}()|[\\]\\\\]/g, '\\\\$&');
              const regex = new RegExp(`(?:^|\\\\s|\\\\b)${escapedNormValue}(?:\\\\b|\\\\s|$)`);
              if (regex.test(cellValue)) {
                cellFound = true;
                break;
              }
            }
          }
        }
      } else {
        inTable = false;
        currentHeaders = [];
      }
    }
    if (cellFound) found++;
  }
  return found;
}

export function evaluateRetention(
  text: string,
  requiredFacts: string[] = [],
  requiredCodeFragments: string[] = [],
  requiredHeadings: string[] = [],
  requiredTableCells: TableCellRequirement[] = [],
  requiredLinks: string[] = []
): RetentionResult {
  
  const uniqueFacts = Array.from(new Set(requiredFacts));
  const uniqueCodeFragments = Array.from(new Set(requiredCodeFragments));
  const uniqueHeadings = Array.from(new Set(requiredHeadings));
  const uniqueLinks = Array.from(new Set(requiredLinks));

  const foundFacts = countOccurrences(text, uniqueFacts);
  const foundCodeFragments = countOccurrences(text, uniqueCodeFragments);
  const foundHeadings = countOccurrences(text, uniqueHeadings);
  const foundLinks = countOccurrences(text, uniqueLinks);
  const foundTableCells = evaluateTableCells(text, requiredTableCells);

  return {
    factRetentionRate: calculateRate(foundFacts, uniqueFacts.length),
    codeRetentionRate: calculateRate(foundCodeFragments, uniqueCodeFragments.length),
    headingRetentionRate: calculateRate(foundHeadings, uniqueHeadings.length),
    tableCellRetentionRate: calculateRate(foundTableCells, requiredTableCells.length),
    linkTargetRetentionRate: calculateRate(foundLinks, uniqueLinks.length),

    totalRequiredFacts: uniqueFacts.length,
    foundFacts,
    totalRequiredCodeFragments: uniqueCodeFragments.length,
    foundCodeFragments,
    totalRequiredHeadings: uniqueHeadings.length,
    foundHeadings,
    totalRequiredTableCells: requiredTableCells.length,
    foundTableCells,
    totalRequiredLinks: uniqueLinks.length,
    foundLinks
  };
}
