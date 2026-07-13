import { parseHTML } from 'linkedom';
import { extractFromHtml } from '../../src/scraper';

export function getRawHtml(html: string): string {
  return html;
}

export function getBodyText(html: string): string {
  const { document } = parseHTML(html);
  
  // Remove script, style, noscript tags
  const tagsToRemove = document.querySelectorAll('script, style, noscript');
  for (const tag of tagsToRemove) {
    tag.remove();
  }

  // Fallback if body is not parsed
  if (!document.body) return '';

  // Get text content and clean up whitespace
  const text = document.body.textContent || '';
  return text.trim();
}

export function getLightcrawlFull(html: string, url: string): string {
  const result = extractFromHtml(html, url, 'full', true);
  return result.markdown;
}

export function getLightcrawlArticle(html: string, url: string): string {
  const result = extractFromHtml(html, url, 'article', true);
  return result.markdown;
}

export function getLightcrawlAutoCandidate(html: string, url: string): string {
  const article = extractFromHtml(html, url, 'article', true);
  const bodyText = getBodyText(html);
  
  const articleLen = article.markdown.length;
  const bodyLen = bodyText.length;
  
  if (bodyLen > 1000 && articleLen < 300) {
    return extractFromHtml(html, url, 'full', true).markdown;
  }
  
  if (bodyLen > 0 && (articleLen / bodyLen) < 0.15) {
    return extractFromHtml(html, url, 'full', true).markdown;
  }
  
  const { document } = parseHTML(html);
  const codeBlocks = document.querySelectorAll('pre, code, table').length;
  const articleCodeBlocks = (article.markdown.match(/```/g) || []).length / 2 + (article.markdown.match(/\|---|/g) || []).length;
  
  if (codeBlocks > 5 && articleCodeBlocks < 1) {
     return extractFromHtml(html, url, 'full', true).markdown;
  }

  return article.markdown;
}
