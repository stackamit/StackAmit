import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiArrowLeft, FiClock, FiEye, FiShare2, FiTag, FiBookOpen,
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const typeColor = (t) => ({
  course: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  tutorial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  guide: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  blog: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  other: 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400',
}[t] || 'bg-dark-100 text-dark-600 dark:bg-dark-700 dark:text-dark-400');

const getAuthorName = (a) =>
  a?.author?.name || `${a?.author?.firstName || ''} ${a?.author?.lastName || ''}`.trim() || 'Anonymous';

// ─── Safe inline Markdown renderer (React nodes only — no HTML injection) ────
const INLINE_RE = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;

const renderInline = (text, keyBase = 'i') => {
  if (!text) return null;
  const elements = [];
  let lastIdx = 0;
  let idx = 0;

  for (const m of String(text).matchAll(INLINE_RE)) {
    const start = m.index;
    if (start > lastIdx) elements.push(String(text).slice(lastIdx, start));
    const token = m[0];

    if (token.startsWith('**')) {
      elements.push(<strong key={`${keyBase}-${idx++}`} className="font-bold">{m[1]}</strong>);
    } else if (token.startsWith('`')) {
      elements.push(
        <code key={`${keyBase}-${idx++}`} className="px-1.5 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-primary-700 dark:text-primary-400 text-sm font-mono">
          {m[3]}
        </code>
      );
    } else if (token.startsWith('[')) {
      elements.push(
        <a key={`${keyBase}-${idx++}`} href={m[5]} target="_blank" rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 hover:underline">
          {m[4]}
        </a>
      );
    } else {
      elements.push(<em key={`${keyBase}-${idx++}`} className="italic">{m[2]}</em>);
    }
    lastIdx = start + token.length;
  }
  if (lastIdx < String(text).length) elements.push(String(text).slice(lastIdx));
  return elements;
};

// ─── Block-level Markdown renderer ───────────────────────────────────────────
const SPECIAL_LINE = /^(#{1,3}\s|>\s?|\s*[-*+]\s|\s*\d+\.\s|```|(-{3,}|_{3,})\s*$)/;

const renderContent = (content) => {
  const blocks = [];
  const lines = String(content || '').split(/\r?\n/);
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={key++} className="my-6 p-4 rounded-xl bg-dark-900 dark:bg-black/60 text-dark-100 overflow-x-auto text-sm leading-relaxed">
          <code className="font-mono">{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-8 border-dark-200 dark:border-dark-700" />);
      i++;
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const inner = renderInline(heading[2].trim(), `h-${key}`);
      if (level === 1) {
        blocks.push(<h2 key={key++} className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white mt-10 mb-4">{inner}</h2>);
      } else if (level === 2) {
        blocks.push(<h3 key={key++} className="text-xl sm:text-2xl font-bold text-dark-900 dark:text-white mt-8 mb-3">{inner}</h3>);
      } else {
        blocks.push(<h4 key={key++} className="text-lg font-bold text-dark-900 dark:text-white mt-6 mb-2">{inner}</h4>);
      }
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-6 pl-4 border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-900/10 py-3 pr-4 rounded-r-lg text-dark-700 dark:text-dark-300 italic">
          {renderInline(quoteLines.join(' '), `q-${key}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-5 space-y-2 pl-6 list-disc list-outside marker:text-primary-600 dark:marker:text-primary-400">
          {items.map((it, j) => (
            <li key={j} className="text-dark-700 dark:text-dark-300 leading-relaxed">{renderInline(it, `u-${key}-${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-5 space-y-2 pl-6 list-decimal list-outside marker:text-primary-600 dark:marker:text-primary-400">
          {items.map((it, j) => (
            <li key={j} className="text-dark-700 dark:text-dark-300 leading-relaxed">{renderInline(it, `o-${key}-${j}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph: consume consecutive plain lines
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !SPECIAL_LINE.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-4 text-dark-700 dark:text-dark-300 leading-relaxed text-[15px] sm:text-base">
        {renderInline(paraLines.join(' '), `p-${key}`)}
      </p>
    );
  }

  return blocks;
};

const ArticleViewPage = () => {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const lastFetchedRef = useRef(null);

  useEffect(() => {
    // Guard against double fetch (React StrictMode) so view count isn't inflated
    if (lastFetchedRef.current === id) return;
    lastFetchedRef.current = id;
    fetchArticle(id);
  }, [id]);

  const fetchArticle = async (articleId) => {
    setLoading(true);
    setNotFound(false);
    try {
      const { data } = await axios.get(`${API_URL}/api/articles/${articleId}`);
      setArticle(data.data.article);
    } catch (err) {
      console.error('Failed to fetch article:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Article link copied to clipboard');
      } else {
        window.prompt('Copy this article link:', url);
      }
    } catch {
      window.prompt('Copy this article link:', url);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="py-12 min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="py-12 min-h-screen bg-dark-50 dark:bg-dark-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <FiBookOpen size={48} className="mx-auto text-dark-300 dark:text-dark-600 mb-4" />
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Article not found</h1>
          <p className="mt-2 text-dark-500 dark:text-dark-400">
            This article may have been unpublished or removed by its author.
          </p>
          <Link to="/articles" className="mt-6 inline-flex items-center gap-2 btn-primary text-sm">
            <FiArrowLeft size={16} /> Browse Articles
          </Link>
        </div>
      </div>
    );
  }

  const authorName = getAuthorName(article);

  return (
    <div className="py-12 min-h-screen bg-dark-50 dark:bg-dark-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/articles" className="inline-flex items-center gap-2 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
            <FiArrowLeft size={16} /> Back to Articles
          </Link>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
          >
            <FiShare2 size={16} /> Share
          </button>
        </div>

        <article className="card overflow-hidden">
          {/* Cover */}
          <div className="h-56 sm:h-72 bg-gradient-to-br from-primary-600 to-primary-400 relative flex items-center justify-center">
            {article.coverImage?.url ? (
              <img src={article.coverImage.url} alt={article.title} className="w-full h-full object-cover" />
            ) : (
              <FiBookOpen size={56} className="text-white/70" />
            )}
            <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold capitalize ${typeColor(article.type)}`}>
              {article.type}
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="p-6 sm:p-10"
          >
            {/* Category */}
            {article.category && (
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
                {article.category}
              </p>
            )}

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white leading-tight">
              {article.title}
            </h1>

            {/* Author & meta */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 pb-6 border-b border-dark-100 dark:border-dark-700">
              <div className="flex items-center gap-3">
                {article.author?.avatar?.url ? (
                  <img src={article.author.avatar.url} alt={authorName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center font-bold">
                    {authorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="font-semibold text-dark-900 dark:text-white text-sm">{authorName}</p>
                  <p className="text-xs text-dark-500 dark:text-dark-400">{formatDate(article.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-dark-500 dark:text-dark-400">
                {article.readTime > 0 && (
                  <span className="flex items-center gap-1.5"><FiClock size={14} /> {article.readTime} min read</span>
                )}
                <span className="flex items-center gap-1.5"><FiEye size={14} /> {article.views || 0} views</span>
              </div>
            </div>

            {/* Tags */}
            {article.tags?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {article.tags.map((tag, j) => (
                  <Link
                    key={j}
                    to={`/articles?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 rounded-full text-xs hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
                  >
                    <FiTag size={11} /> {tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="mt-6">
              {renderContent(article.content)}
            </div>
          </motion.div>
        </article>

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          <Link to="/articles" className="inline-flex items-center gap-2 btn-outline text-sm">
            <FiArrowLeft size={16} /> Explore more articles
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ArticleViewPage;
