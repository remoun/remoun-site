import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';

interface EditorProps {
  initialContent: string;
  onChange: (markdown: string) => void;
}

export function Editor({ initialContent, onChange }: EditorProps) {
  const isInitialized = useRef(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing, or press '/' for commands...",
      }),
    ],
    content: markdownToHtml(initialContent),
    editorProps: {
      attributes: {
        class: 'novel-editor prose prose-stone max-w-none min-h-[400px] p-6 focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setSlashMenuPos({ top: coords.bottom + 10, left: coords.left });
          setSlashFilter('');
          setShowSlashMenu(true);
          return false;
        }
        if (showSlashMenu) {
          if (event.key === 'Escape') {
            setShowSlashMenu(false);
            return true;
          }
          if (event.key === 'Backspace' && slashFilter === '') {
            setShowSlashMenu(false);
            return false;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            setSlashFilter(prev => prev + event.key);
            return false;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = htmlToMarkdown(editor.getHTML());
      onChange(markdown);
    },
  });

  // Set initial content only once
  useEffect(() => {
    if (editor && !isInitialized.current && initialContent) {
      editor.commands.setContent(markdownToHtml(initialContent));
      isInitialized.current = true;
    }
  }, [editor, initialContent]);

  // Close slash menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowSlashMenu(false);
    if (showSlashMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showSlashMenu]);

  const executeSlashCommand = (command: () => void) => {
    // Delete the slash and any filter text
    if (editor) {
      const { from } = editor.state.selection;
      editor.chain()
        .deleteRange({ from: from - slashFilter.length - 1, to: from })
        .run();
      command();
    }
    setShowSlashMenu(false);
  };

  const slashCommands = [
    { label: 'Heading 1', icon: 'H1', command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', icon: 'H2', command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', icon: 'H3', command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Bullet List', icon: '•', command: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Numbered List', icon: '1.', command: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: 'Quote', icon: '"', command: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: 'Code Block', icon: '{ }', command: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: 'Divider', icon: '—', command: () => editor?.chain().focus().setHorizontalRule().run() },
  ];

  const filteredCommands = slashCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  if (!editor) {
    return (
      <div className="min-h-[400px] p-6 text-stone-400">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Bubble Menu - appears when text is selected */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        className="bg-stone-900 rounded-lg shadow-lg flex items-center overflow-hidden"
      >
        <BubbleButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </BubbleButton>
        <BubbleButton
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          {'</>'}
        </BubbleButton>
      </BubbleMenu>

      {/* Slash Command Menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div
          className="absolute z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[200px]"
          style={{ top: slashMenuPos.top, left: slashMenuPos.left }}
        >
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => executeSlashCommand(cmd.command)}
              className="w-full text-left px-3 py-2 hover:bg-stone-100 flex items-center gap-3 text-sm"
            >
              <span className="w-6 text-center text-stone-400 font-mono">{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />

      <style>{`
        .novel-editor h1 { font-size: 2em; font-weight: 600; margin: 1em 0 0.5em; }
        .novel-editor h2 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; }
        .novel-editor h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
        .novel-editor p { margin: 0.5em 0; line-height: 1.7; }
        .novel-editor ul, .novel-editor ol { padding-left: 1.5em; margin: 0.5em 0; }
        .novel-editor li { margin: 0.25em 0; }
        .novel-editor blockquote { border-left: 3px solid #d4d4d4; padding-left: 1em; margin: 1em 0; color: #737373; font-style: italic; }
        .novel-editor code { background: #f5f5f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
        .novel-editor pre { background: #292524; color: #fafaf9; padding: 1em; border-radius: 6px; margin: 1em 0; overflow-x: auto; }
        .novel-editor pre code { background: none; padding: 0; color: inherit; }
        .novel-editor hr { border: none; border-top: 1px solid #e7e5e4; margin: 2em 0; }
        .novel-editor .ProseMirror-focused { outline: none; }
        .novel-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #a8a29e;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function BubbleButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm transition-colors ${
        active ? 'bg-stone-700 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// Simple markdown to HTML converter (for display)
function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';

  let html = markdown
    // Code blocks (before other processing)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (wrap remaining lines)
    .split('\n\n')
    .map((block) => {
      if (
        block.startsWith('<h') ||
        block.startsWith('<pre') ||
        block.startsWith('<blockquote') ||
        block.startsWith('<hr') ||
        block.startsWith('<li')
      ) {
        return block;
      }
      if (block.trim()) {
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
      }
      return '';
    })
    .join('');

  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

  return html || '<p></p>';
}

// HTML to markdown converter (for saving)
function htmlToMarkdown(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1':
        return `# ${children}\n\n`;
      case 'h2':
        return `## ${children}\n\n`;
      case 'h3':
        return `### ${children}\n\n`;
      case 'p':
        return `${children}\n\n`;
      case 'strong':
        return `**${children}**`;
      case 'em':
        return `*${children}*`;
      case 's':
        return `~~${children}~~`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return children;
        }
        return `\`${children}\``;
      case 'pre':
        return `\`\`\`\n${children}\`\`\`\n\n`;
      case 'blockquote':
        return children
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => `> ${line}`)
          .join('\n') + '\n\n';
      case 'ul':
        return children;
      case 'ol':
        return children;
      case 'li':
        const parent = el.parentElement?.tagName.toLowerCase();
        if (parent === 'ol') {
          const index = Array.from(el.parentElement!.children).indexOf(el) + 1;
          return `${index}. ${children.trim()}\n`;
        }
        return `- ${children.trim()}\n`;
      case 'hr':
        return '---\n\n';
      case 'br':
        return '\n';
      default:
        return children;
    }
  }

  return processNode(div).trim();
}
