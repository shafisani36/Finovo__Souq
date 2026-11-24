import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Select, type SelectOption } from './Select';

interface FieldWrapperProps {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

function FieldWrapper({ id, label, required, hint, error, className, children }: FieldWrapperProps) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__required" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, hint, error, icon, suffix, wrapperClassName, id, required, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrapper id={fieldId} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={['input', icon && 'input--with-icon', suffix && 'input--with-suffix', className].filter(Boolean).join(' ')}
          {...rest}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </div>
    </FieldWrapper>
  );
});

interface SelectFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  wrapperClassName?: string;
}

export function SelectField({ label, hint, error, placeholder, options, value, onChange, required, disabled, id, wrapperClassName }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrapper id={fieldId} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <Select
        id={fieldId}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
      />
    </FieldWrapper>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function TextareaField({ label, hint, error, wrapperClassName, id, required, className, ...rest }: TextareaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrapper id={fieldId} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={['textarea', className].filter(Boolean).join(' ')}
        {...rest}
      />
    </FieldWrapper>
  );
}
