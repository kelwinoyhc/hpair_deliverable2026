import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useField, useFormikContext } from 'formik';
import { FiUploadCloud, FiFileText, FiX, FiAlertCircle } from 'react-icons/fi';
import { CV_ACCEPTED_TYPES, CV_MAX_BYTES } from '../validation/schemas';

/**
 * CV upload.
 *
 * The file lives in Formik state like any other value, and its size/type rules
 * live in the Yup schema rather than here -- so a file that is too large produces
 * an error in the same place, in the same style, as a malformed phone number.
 *
 * One case the schema can't cover: a file the dropzone rejects outright (dragged
 * in while over the size limit, say) never reaches Formik state, so there is no
 * value to validate. `rejection` holds that message locally and takes precedence
 * over the schema error, which would otherwise just say "please attach your CV"
 * and lose the reason.
 *
 * `restoredName` handles a real edge case in auto-save: we can restore every text
 * answer from localStorage but never the file, because a page cannot re-attach a
 * file the user didn't just choose. Rather than look complete with nothing
 * attached, we name the file they had and ask for it again.
 */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rejectionMessage(rejections) {
  const code = rejections[0]?.errors?.[0]?.code;
  if (code === 'file-too-large') return 'That file is larger than 5 MB.';
  if (code === 'too-many-files') return 'Please attach a single file.';
  return 'Upload a PDF, DOC, or DOCX file.';
}

export default function CvUpload({ name = 'cv', restoredName, onRestoredNameCleared }) {
  const [field, meta] = useField(name);
  const { setFieldValue, setFieldTouched } = useFormikContext();
  const [rejection, setRejection] = useState(null);

  const file = field.value;

  const onDropAccepted = useCallback(
    (accepted) => {
      setRejection(null);
      setFieldValue(name, accepted[0], true);
      setFieldTouched(name, true, false);
      if (onRestoredNameCleared) onRestoredNameCleared();
    },
    [name, setFieldValue, setFieldTouched, onRestoredNameCleared]
  );

  const onDropRejected = useCallback(
    (rejections) => {
      setRejection(rejectionMessage(rejections));
      setFieldTouched(name, true, false);
    },
    [name, setFieldTouched]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted,
    onDropRejected,
    accept: CV_ACCEPTED_TYPES,
    maxSize: CV_MAX_BYTES,
    multiple: false,
  });

  const remove = () => {
    setRejection(null);
    setFieldValue(name, null, true);
    setFieldTouched(name, true, false);
  };

  const error = rejection || (meta.touched && meta.error) || null;
  const describedBy = [`${name}-hint`, error ? `${name}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="form-group">
      <span className="form-label" id={`${name}-label`}>
        CV / Résumé{' '}
        <span className="required-mark" aria-hidden="true">
          *
        </span>
        <span className="sr-only">(required)</span>
      </span>

      {file ? (
        <div className="file-list">
          <div className="file-item">
            <div className="file-info">
              <FiFileText aria-hidden="true" />
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatBytes(file.size)}</span>
            </div>
            <button
              type="button"
              className="remove-file"
              onClick={remove}
              aria-label={`Remove ${file.name}`}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps({
            className: `file-upload-area${isDragActive ? ' dragover' : ''}${error ? ' has-error' : ''}`,
            'aria-labelledby': `${name}-label`,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })}
        >
          <input {...getInputProps({ id: name })} />
          <FiUploadCloud className="upload-icon" aria-hidden="true" />
          <p className="upload-primary">
            {isDragActive ? 'Drop your CV here' : 'Drag your CV here, or click to browse'}
          </p>
          <p className="upload-secondary">PDF, DOC, or DOCX · up to 5 MB</p>
        </div>
      )}

      {restoredName && !file && (
        <p className="form-hint restored-file-note" role="status">
          You previously attached <strong>{restoredName}</strong>. Files can&apos;t be restored
          automatically — please attach it again.
        </p>
      )}

      <p className="form-hint" id={`${name}-hint`}>
        We accept a PDF, DOC, or DOCX up to 5 MB.
      </p>

      {error && (
        <p className="form-error" id={`${name}-error`} role="alert">
          <FiAlertCircle className="form-error-icon" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
