import React from 'react';

interface RichTextRendererProps {
  text: string;
  className?: string;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({ text, className = '' }) => {
  // Function to parse and format text with basic markdown-like features
  const formatText = (inputText: string) => {
    // Replace all occurrences of formatting patterns first
    let processedText = inputText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold **text**
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic *text*
      .replace(/__(.*?)__/g, '<strong>$1</strong>') // Bold __text__
      .replace(/_(.*?)_/g, '<em>$1</em>') // Italic _text_
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-emerald-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>') // Links [text](url)
      .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-slate-800 px-1 rounded">$1</code>') // Inline code `code`
      .replace(/~~(.*?)~~/g, '<del>$1</del>') // Strikethrough ~~text~~;

    // Split text into blocks: paragraphs, lists, etc.
    const blocks = processedText.split(/\n\s*\n/);

    return blocks.map((block, index) => {
      const lines = block.split('\n');
      const isList = lines.some(line =>
        /^\s*[-*+]\s/.test(line.trim()) || /^\s*\d+\.\s/.test(line.trim())
      );

      if (isList) {
        // Process as list
        const listItems = lines
          .filter(line => line.trim() !== '')
          .map((line, idx) => {
            const trimmedLine = line.trim();
            const indentLevel = (line.match(/^\s*/)?.[0].length || 0) / 2;
            const indentClass = indentLevel > 0 ? `ml-${indentLevel * 4}` : '';

            if (/^\s*\d+\.\s/.test(trimmedLine)) {
              // Numbered list
              const content = trimmedLine.replace(/^\s*\d+\.\s/, '');
              return `<li class="${indentClass} list-decimal list-outside ml-6">${content}</li>`;
            } else if (/^\s*[-*+]\s/.test(trimmedLine)) {
              // Bullet list
              const content = trimmedLine.replace(/^\s*[-*+]\s/, '');
              return `<li class="${indentClass} list-disc list-outside ml-6">${content}</li>`;
            } else {
              // Regular line in a list context (shouldn't happen if input is properly formatted)
              return `<li class="${indentClass} list-disc list-outside ml-6">${trimmedLine}</li>`;
            }
          })
          .join('');

        return `<ul class="mb-4 space-y-2">${listItems}</ul>`;
      } else {
        // Process as paragraph
        const paragraphContent = lines
          .filter(line => line.trim() !== '')
          .map(line => `<p class="mb-4 leading-relaxed text-gray-700">${line.trim()}</p>`)
          .join('');

        return paragraphContent;
      }
    }).join('');
  };

  const formattedText = formatText(text);

  return (
    <div
      className={`font-sans text-base leading-relaxed text-emerald-700 max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedText }}
    />
  );
};

export default RichTextRenderer;