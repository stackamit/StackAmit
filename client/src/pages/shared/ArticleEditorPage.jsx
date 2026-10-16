import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  FiArrowLeft, FiSave, FiUploadCloud, FiX, FiImage, FiBookOpen, FiLink,
} from 'react-icons/fi';

const ARTICLE_TYPES = [
  { value: 'course', label: 'Course' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'guide', label: 'Guide' },
  { value: 'blog', label: 'Blog' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  title: '',
  type: 'blog',
  category: '',
  excerpt: '',
  content: '',
  tags: '',
  coverImage: null,
};

const ArticleEditorPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [originalStatus, setOriginalStatus] = useState('draft');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(''); // 'draft' | 'publish'
  const [uploadingImage, setUploadingImage] = useState(false);

  // Inline content image insertion state
  const contentRef = useRef(null);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [uploadingContentImage, setUploadingContentImage] = useState(false);

  const listPath = `/${user?.role || 'student'}/articles`;

  useEffect(() => {
    if (isEdit) fetchArticle(id);
  }, [id]);

  const fetchArticle = async (articleId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/articles/my/${articleId}`);
      const a = data.data.article;
      setForm({
        title: a.title || '',
        type: a.type || 'blog',
        category: a.category || '',
        excerpt: a.excerpt || '',
        content: a.content || '',
        tags: (a.tags || []).join(', '),
        coverImage: a.coverImage || null,
      });
      setOriginalStatus(a.status || 'draft');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load article');
      navigate(listPath, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'articles');
      const { data } = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.data?.url) {
        setForm((f) => ({ ...f, coverImage: { public_id: data.data.public_id, url: data.data.url } }));
        toast.success('Cover image uploaded');
      } else {
        toast.error('Upload failed, please try again');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeCover = () => {
    setForm((f) => ({ ...f, coverImage: null }));
  };

  // Insert a Markdown image at the cursor of the content textarea,
  // kept on its own line so the article renderer shows it as a figure.
  const insertImageMarkdown = (url, alt) => {
    const snippet = `![${(alt || '').trim() || 'image'}](${url})`;
    const ref = contentRef.current;
    const current = form.content;
    const start = ref ? ref.selectionStart : current.length;
    const end = ref ? ref.selectionEnd : current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const prefix = before && !before.endsWith('\n') ? '\n' : '';
    const suffix = after && !after.startsWith('\n') ? '\n' : '';
    const inserted = `${prefix}${snippet}${suffix}`;
    setForm((f) => ({ ...f, content: before + inserted + after }));
    const caret = (before + inserted).length;
    requestAnimationFrame(() => {
      if (ref) { ref.focus(); ref.setSelectionRange(caret, caret); }
    });
  };

  const handleInsertImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) {
      toast.error('Enter an image URL first');
      return;
    }
    if (!/^(https?:\/\/\S+|\/\S*)$/i.test(url)) {
      toast.error('Image URL must start with http(s):// or /');
      return;
    }
    insertImageMarkdown(url, imageAlt);
    setImageUrl('');
    setImageAlt('');
    setShowImagePanel(false);
    toast.success('Image inserted into content');
  };

  const handleContentImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG/JPG/WebP/GIF)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploadingContentImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'articles');
      const { data } = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.data?.url) {
        insertImageMarkdown(data.data.url, file.name.replace(/\.[^.]+$/, ''));
        setShowImagePanel(false);
        toast.success('Image uploaded and inserted');
      } else {
        toast.error('Upload failed, please try again');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingContentImage(false);
    }
  };

  const validate = () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return false;
    }
    if (form.title.trim().length > 200) {
      toast.error('Title cannot exceed 200 characters');
      return false;
    }
    if (!form.content.trim()) {
      toast.error('Content is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (status) => {
    if (!validate() || submitting) return;
    setSubmitting(status);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        category: form.category.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content,
        tags: form.tags, // backend normalizes (comma string or array, lowercase, max 10)
        coverImage: form.coverImage,
        status,
      };

      if (isEdit) {
        await api.put(`/articles/${id}`, payload);
        toast.success(status === 'published' ? 'Article updated & published' : 'Draft updated');
      } else {
        await api.post('/articles', payload);
        toast.success(status === 'published' ? 'Article published successfully' : 'Article saved as draft');
      }
      navigate(listPath);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save article');
    } finally {
      setSubmitting('');
    }
  };

  if (loading) {
    return (
      <div className="card p-10 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">
            {isEdit ? 'Edit Article' : 'Write New Article'}
          </h1>
          <p className="mt-1 text-dark-500 dark:text-dark-400">
            {isEdit
              ? `Editing${originalStatus === 'published' ? ' published' : ''} article — changes are visible immediately.`
              : 'Share a course, tutorial, guide or blog with the community.'}
          </p>
        </div>
        <Link to={listPath} className="inline-flex items-center gap-2 text-sm font-medium text-dark-600 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-shrink-0">
          <FiArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="card p-5 sm:p-8 space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="title" className="text-sm font-semibold text-dark-900 dark:text-white">
              Title <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-dark-400">{form.title.length}/200</span>
          </div>
          <input
            id="title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            maxLength={200}
            placeholder="e.g. Complete Guide to Learning React in 2026"
            className="input-field w-full text-lg font-medium"
          />
        </div>

        {/* Type + Category */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-semibold text-dark-900 dark:text-white mb-1.5">
              Article Type
            </label>
            <select id="type" name="type" value={form.type} onChange={handleChange} className="input-field w-full cursor-pointer">
              {ARTICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="category" className="text-sm font-semibold text-dark-900 dark:text-white">
                Category
              </label>
              <span className="text-xs text-dark-400">{form.category.length}/60</span>
            </div>
            <input
              id="category"
              name="category"
              type="text"
              value={form.category}
              onChange={handleChange}
              maxLength={60}
              placeholder="e.g. Web Development"
              className="input-field w-full"
            />
          </div>
        </div>

        {/* Excerpt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="excerpt" className="text-sm font-semibold text-dark-900 dark:text-white">
              Excerpt <span className="font-normal text-dark-400">(short summary shown in listings)</span>
            </label>
            <span className="text-xs text-dark-400">{form.excerpt.length}/500</span>
          </div>
          <textarea
            id="excerpt"
            name="excerpt"
            value={form.excerpt}
            onChange={handleChange}
            maxLength={500}
            rows={2}
            placeholder="A brief summary of your article. Leave empty to auto-generate from content."
            className="input-field w-full resize-y"
          />
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-semibold text-dark-900 dark:text-white mb-1.5">
            Cover Image <span className="font-normal text-dark-400">(optional)</span>
          </label>
          {form.coverImage?.url ? (
            <div className="relative rounded-xl overflow-hidden border border-dark-200 dark:border-dark-700 group w-full sm:w-80">
              <img src={form.coverImage.url} alt="Cover preview" className="w-full h-40 object-cover" />
              <button
                type="button"
                onClick={removeCover}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-dark-900/70 text-white hover:bg-red-600 transition-colors"
                aria-label="Remove cover image"
              >
                <FiX size={16} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-dark-200 dark:border-dark-700 cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors">
              {uploadingImage ? (
                <>
                  <span className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></span>
                  <span className="text-xs text-dark-500 dark:text-dark-400">Uploading...</span>
                </>
              ) : (
                <>
                  <FiImage size={24} className="text-dark-400" />
                  <span className="text-xs text-dark-500 dark:text-dark-400">
                    Click to upload cover image (JPG/PNG/GIF/WebP, max 5MB)
                  </span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingImage} className="hidden" />
            </label>
          )}
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
            <label htmlFor="content" className="text-sm font-semibold text-dark-900 dark:text-white">
              Content <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowImagePanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showImagePanel
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                  : 'border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-400 dark:hover:border-primary-600'
              }`}
            >
              <FiImage size={14} /> Insert Image
            </button>
          </div>

          {/* Image insertion panel: paste a URL or upload a PNG/image */}
          {showImagePanel && (
            <div className="mb-3 p-4 rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 space-y-3">
              <p className="text-xs font-medium text-dark-600 dark:text-dark-300">
                Add an image inside your article — paste an image URL or upload a PNG/image file.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInsertImageUrl(); } }}
                  placeholder="Image URL (https://...)"
                  className="input-field w-full text-sm"
                />
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInsertImageUrl(); } }}
                  placeholder="Caption / alt text (optional)"
                  className="input-field w-full text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertImageUrl}
                  disabled={!imageUrl.trim()}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <FiLink size={14} /> Insert Image URL
                </button>
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  uploadingContentImage
                    ? 'border-dark-200 dark:border-dark-700 text-dark-400 cursor-wait'
                    : 'border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 hover:border-primary-400 dark:hover:border-primary-600'
                }`}>
                  {uploadingContentImage ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary-600 border-t-transparent"></span>
                  ) : (
                    <FiUploadCloud size={14} />
                  )}
                  {uploadingContentImage ? 'Uploading...' : 'Upload PNG / Image'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleContentImageUpload} disabled={uploadingContentImage} className="hidden" />
                </label>
              </div>
            </div>
          )}

          <textarea
            id="content"
            name="content"
            ref={contentRef}
            value={form.content}
            onChange={handleChange}
            rows={16}
            placeholder={'Write your article here...\n\nMarkdown is supported:\n# Heading 1\n## Heading 2\n**bold text**, *italic*, `inline code`\n- bullet list\n1. numbered list\n> quote\n```code block```\n![caption](https://example.com/image.png)  ← image (or use Insert Image)'}
            className="input-field w-full resize-y font-mono text-sm leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-dark-400">
            <FiBookOpen size={11} className="inline mr-1" />
            Markdown supported: headings, lists, bold, italic, code blocks, quotes, links and images (![caption](image-url)).
          </p>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="tags" className="block text-sm font-semibold text-dark-900 dark:text-white mb-1.5">
            Tags <span className="font-normal text-dark-400">(comma separated, max 10)</span>
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            value={form.tags}
            onChange={handleChange}
            placeholder="e.g. react, javascript, frontend"
            className="input-field w-full"
          />
          {form.tags.trim() && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10).map((t, j) => (
                <span key={j} className="px-2 py-0.5 bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400 rounded text-xs">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={Boolean(submitting)}
            className="btn-outline inline-flex items-center justify-center gap-2 text-sm"
          >
            {submitting === 'draft' ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></span>
            ) : (
              <FiSave size={16} />
            )}
            {isEdit ? 'Save Draft' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('publish')}
            disabled={Boolean(submitting)}
            className="btn-primary inline-flex items-center justify-center gap-2 text-sm"
          >
            {submitting === 'publish' ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></span>
            ) : (
              <FiUploadCloud size={16} />
            )}
            {isEdit ? 'Update & Publish' : 'Publish Article'}
          </button>
        </div>
        <p className="text-xs text-dark-400 text-center sm:text-right">
          Drafts are private to you. Published articles appear on the public Articles page.
        </p>
      </div>
    </div>
  );
};

export default ArticleEditorPage;
