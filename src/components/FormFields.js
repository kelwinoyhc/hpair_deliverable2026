import React from 'react';
import { useField } from 'formik';
import { FiAlertCircle } from 'react-icons/fi';

/**
 * Field primitives.
 *
 * The accessibility wiring -- label association, `aria-invalid`, and pointing
 * `aria-describedby` at both the hint and the error message -- is easy to get
 * subtly wrong and tedious to repeat. Doing it once here means every field on
 * every step is announced correctly by a screen reader, and the error styling
 * stays consistent for free.
 *
 * The DOM `id` is the Formik field name, which lets the wizard move focus to the
 * first invalid field by name after a failed "Next".
 */

function useFieldState(name) {
  const [field, meta] = useField(name);
  const showError = Boolean(meta.touched && meta.error);
  return { field, meta, showError };
}

function Label({ htmlFor, children, required }) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
      {required && (
        <>
          {' '}
          <span className="required-mark" aria-hidden="true">
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
    </label>
  );
}

function Messages({ name, hint, showError, error }) {
  return (
    <>
      {hint && (
        <p className="form-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {showError && (
        <p className="form-error" id={`${name}-error`} role="alert">
          {/* The icon is not decoration. The brand colour here is crimson, so an
              error tinted red alone would be ambiguous -- the icon makes an error
              identifiable by shape, which is also what WCAG 1.4.1 requires. */}
          <FiAlertCircle className="form-error-icon" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </>
  );
}

function describedBy(name, hint, showError) {
  const ids = [];
  if (hint) ids.push(`${name}-hint`);
  if (showError) ids.push(`${name}-error`);
  return ids.length ? ids.join(' ') : undefined;
}

export function TextField({ name, label, hint, required, type = 'text', ...rest }) {
  const { field, meta, showError } = useFieldState(name);
  return (
    <div className="form-group">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <input
        {...field}
        {...rest}
        id={name}
        type={type}
        className={`form-input${showError ? ' has-error' : ''}`}
        aria-invalid={showError || undefined}
        aria-describedby={describedBy(name, hint, showError)}
      />
      <Messages name={name} hint={hint} showError={showError} error={meta.error} />
    </div>
  );
}

export function SelectField({ name, label, hint, required, options, placeholder = 'Select an option' }) {
  const { field, meta, showError } = useFieldState(name);
  return (
    <div className="form-group">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <select
        {...field}
        id={name}
        className={`form-input${showError ? ' has-error' : ''}`}
        aria-invalid={showError || undefined}
        aria-describedby={describedBy(name, hint, showError)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Messages name={name} hint={hint} showError={showError} error={meta.error} />
    </div>
  );
}

/**
 * Radios are grouped in a fieldset with a legend rather than a label, which is
 * what lets assistive tech announce "Do you have a LinkedIn profile? 1 of 2".
 */
export function RadioGroup({ name, label, hint, required, options }) {
  const { field, meta, showError } = useFieldState(name);
  return (
    <div className="form-group">
      <fieldset
        className="radio-fieldset"
        aria-invalid={showError || undefined}
        aria-describedby={describedBy(name, hint, showError)}
      >
        <legend className="form-label">
          {label}
          {required && (
            <>
              {' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </>
          )}
        </legend>
        <div className="radio-row">
          {options.map((option) => (
            <label className="radio-option" key={option.value} htmlFor={`${name}-${option.value}`}>
              <input
                type="radio"
                id={`${name}-${option.value}`}
                name={name}
                value={option.value}
                checked={field.value === option.value}
                onChange={() => field.onChange({ target: { name, value: option.value } })}
                onBlur={field.onBlur}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <Messages name={name} hint={hint} showError={showError} error={meta.error} />
      </fieldset>
    </div>
  );
}

export function CheckboxField({ name, label, hint }) {
  const { field, meta, showError } = useFieldState(name);
  return (
    <div className="form-group">
      <label className="checkbox-option" htmlFor={name}>
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={Boolean(field.value)}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy(name, hint, showError)}
        />
        <span>{label}</span>
      </label>
      <Messages name={name} hint={hint} showError={showError} error={meta.error} />
    </div>
  );
}

export function TextAreaField({ name, label, hint, required, rows = 4, maxLength, ...rest }) {
  const { field, meta, showError } = useFieldState(name);
  const used = (field.value || '').length;

  return (
    <div className="form-group">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <textarea
        {...field}
        {...rest}
        id={name}
        rows={rows}
        maxLength={maxLength}
        className={`form-input form-textarea${showError ? ' has-error' : ''}`}
        aria-invalid={showError || undefined}
        aria-describedby={describedBy(name, hint, showError)}
      />
      {/*
        A live character count, but only once the user is close to the limit --
        showing "0 / 800" from the start reads as a demand for 800 characters.
        aria-live is off deliberately: announcing every keystroke is hostile to a
        screen-reader user, and maxLength already stops them overrunning.
      */}
      {maxLength && used > maxLength * 0.75 && (
        <p className="char-count">
          {used} / {maxLength}
        </p>
      )}
      <Messages name={name} hint={hint} showError={showError} error={meta.error} />
    </div>
  );
}

/**
 * A group of checkboxes backed by a single array value.
 *
 * Grouped in a fieldset/legend for the same reason as the radios. Unlike
 * RadioGroup this writes an array, so the schema can require "at least one".
 */
export function CheckboxGroup({ name, label, hint, required, options }) {
  const [field, meta, helpers] = useField(name);
  const selected = Array.isArray(field.value) ? field.value : [];
  const showError = Boolean(meta.touched && meta.error);

  const toggle = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    helpers.setValue(next);
    helpers.setTouched(true, false);
  };

  return (
    <div className="form-group">
      <fieldset
        className="radio-fieldset"
        aria-invalid={showError || undefined}
        aria-describedby={describedBy(name, hint, showError)}
      >
        <legend className="form-label">
          {label}
          {required && (
            <>
              {' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </>
          )}
        </legend>
        <div className="radio-row">
          {options.map((option) => (
            <label
              className="radio-option"
              key={option.value}
              htmlFor={`${name}-${option.value}`}
            >
              <input
                type="checkbox"
                id={`${name}-${option.value}`}
                name={name}
                value={option.value}
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <Messages name={name} hint={hint} showError={showError} error={meta.error} />
      </fieldset>
    </div>
  );
}
