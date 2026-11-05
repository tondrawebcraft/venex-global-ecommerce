import { useEffect, useRef, useState } from 'react';
import api, { errorMessage, unwrap } from '../services/api';
import { useStore } from '../context/StoreContext';
import { addImage, moveImage as moveImageInList, removeImage as removeImageFromList, replaceImage as replaceImageInList, validateImageFile } from './adminImageUploadUtils';

const ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const PRODUCT_ACCEPT = `${ACCEPT},.avif,image/avif`;

export default function AdminImageUpload({ value = [], onChange, folder, single = false, onBusyChange }) {
  const images = Array.isArray(value) ? value.filter(Boolean) : [];
  const { notify } = useStore();
  const [pending, setPending] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const pendingRef = useRef([]);
  const disabled = pending.length > 0;

  useEffect(() => { onBusyChange?.(disabled); }, [disabled, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => () => pendingRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const changePending = (update) => setPending((current) => {
    const next = update(current);
    pendingRef.current = next;
    return next;
  });

  const uploadOne = async (file, replaceIndex) => {
    const validationMessage = validateImageFile(file, folder === 'products');
    if (validationMessage) {
      const problem = `${file.name}: ${validationMessage}`;
      setMessage(problem); notify(problem, 'error'); return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    const item = { id, preview, replaceIndex };
    changePending((current) => [...current, item]);
    setMessage('');
    try {
      const body = new FormData();
      body.append('image', file);
      const endpoint = folder === 'collections' ? '/admin/upload/collections' : '/admin/upload';
      const result = await unwrap(api.post(endpoint, body));
      onChange((current) => replaceIndex !== null ? replaceImageInList(current, replaceIndex, result.url) : addImage(current, result.url, single));
      setMessage('Upload complete. Save the form to keep this image.');
    } catch (error) {
      const problem = errorMessage(error);
      setMessage(problem);
      notify(problem, 'error');
    } finally {
      changePending((current) => current.filter((entry) => entry.id !== id));
      URL.revokeObjectURL(preview);
    }
  };

  const uploadFiles = (files, replaceIndex = null) => {
    const selected = Array.from(files || []);
    const entries = replaceIndex !== null || single ? selected.slice(0, 1) : selected;
    void (async () => {
      for (const file of entries) await uploadOne(file, replaceIndex !== null ? replaceIndex : single && images.length ? 0 : null);
    })();
  };

  const handleInput = (event, replaceIndex = null) => {
    uploadFiles(event.currentTarget.files, replaceIndex);
    event.currentTarget.value = '';
  };

  const removeImage = (index) => onChange((current) => removeImageFromList(current, index));
  const moveImage = (from, to) => onChange((current) => moveImageInList(current, from, to));

  const handleDrop = (event) => {
    event.preventDefault(); setDragging(false);
    uploadFiles(event.dataTransfer.files, single && images.length ? 0 : null);
  };
  const replacement = pending.find((item) => item.replaceIndex === 0);
  const acceptedFormats = folder === 'products' ? 'JPG, JPEG, PNG, WEBP or AVIF' : 'JPG, JPEG, PNG or WEBP';

  return <div className={`admin-image-uploader ${single ? 'admin-image-uploader-single' : ''}`}>
    <div className={`admin-upload-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={handleDrop}>
      <span>{single ? 'Drop one cover image here' : 'Drop product images here'}</span>
      <small>{acceptedFormats} - 5 MB max per image</small>
      <label className="table-action admin-upload-choose">{single ? (images.length ? 'Replace image' : 'Choose image') : 'Choose images'}<input className="admin-image-file-input" type="file" accept={folder === 'products' ? PRODUCT_ACCEPT : ACCEPT} multiple={!single} disabled={disabled} onChange={handleInput} /></label>
    </div>
    {single && (images.length > 0 || replacement || pending.some((item) => item.replaceIndex === null)) && <div className="admin-cover-preview">
      <img src={replacement?.preview || images[0] || pending[0]?.preview} alt="Collection cover preview" />
      <div><span>{replacement ? 'Uploading replacement…' : 'Cover image preview'}</span>{Boolean(images[0]) && <button type="button" className="table-action" disabled={disabled} onClick={() => removeImage(0)}>Remove image</button>}</div>
    </div>}
    {!single && <div className="admin-image-grid">{images.map((image, index) => {
      const pendingReplacement = pending.find((item) => item.replaceIndex === index);
      return <article className="admin-image-card" key={`${image}-${index}`}>
        <img src={pendingReplacement?.preview || image} alt={`Product image ${index + 1}`} />
        <small>{index === 0 ? 'Cover image' : `Image ${index + 1}`}{pendingReplacement ? ' · Uploading replacement…' : ''}</small>
        <div className="admin-image-card-actions">
          <button type="button" className="table-action" disabled={disabled || index === 0} onClick={() => moveImage(index, index - 1)}>Move up</button>
          <button type="button" className="table-action" disabled={disabled || index === images.length - 1} onClick={() => moveImage(index, index + 1)}>Move down</button>
          <label className="table-action admin-image-replace">Replace<input className="admin-image-file-input" type="file" accept={folder === 'products' ? PRODUCT_ACCEPT : ACCEPT} disabled={disabled} onChange={(event) => handleInput(event, index)} /></label>
          <button type="button" className="table-action" disabled={disabled} onClick={() => removeImage(index)}>Remove</button>
        </div>
      </article>;
    })}{pending.filter((item) => item.replaceIndex === null).map((item, index) => <article className="admin-image-card" key={item.id}>
      <img src={item.preview} alt={`New product image ${images.length + index + 1} preview`} />
      <small>Uploading image…</small>
    </article>)}</div>}
    {message && <small className={`admin-upload-message ${message.includes('complete') ? '' : 'is-error'}`} role={message.includes('complete') ? 'status' : 'alert'}>{message}</small>}
  </div>;
}
