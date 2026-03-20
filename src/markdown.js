import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";

// Register common languages (keeps bundle small)
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import csharp from "highlight.js/lib/languages/csharp";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);

// Configure marked to use highlight.js for code blocks
marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    // Auto-detect if no language specified
    return hljs.highlightAuto(code).value;
  }
});

export const parseMarkdown = (rawMarkdown, showCommits = false) => {
  // Preprocess HTML comments if showCommits is active
  if (showCommits) {
    rawMarkdown = rawMarkdown.replace(/<!--([\s\S]*?)-->/g, '<span class="inline-commit">[$1]</span>');
  }

  // Tokenize markdown to map blocks back to source text
  const tokens = marked.lexer(rawMarkdown);

  // Assign unique ID to each top-level token
  tokens.forEach((token, index) => {
    token.blockId = index;
  });

  // Walk tokens and render them manually to inject top-level block IDs
  let htmlResult = "";
  tokens.forEach((token, i) => {
    if (token.type === "space") return;

    let renderedToken = marked.parser([token]);
    renderedToken = renderedToken.replace(
      /^<([a-z0-6]+)/i,
      `<$1 data-block-id="${i}" class="editable-block"`,
    );
    htmlResult += renderedToken;
    htmlResult += `<div class="add-block-btn" data-insert-after="${i}"><button title="Add new paragraph" data-insert-after="${i}"><i data-lucide="plus" style="width: 14px; height: 14px;"></i></button></div>`;
  });

  return {
    html: DOMPurify.sanitize(htmlResult, {
      ADD_ATTR: ["data-block-id", "class", "data-insert-after", "data-comment-target", "data-lucide", "fill", "style", "title"],
      ADD_TAGS: ["button", "i", "span"],
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "select", "textarea"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"]
    }),
    tokens: tokens,
  };
};
