import React from 'react';
import { FiCheck } from 'react-icons/fi';

/**
 * Progress indicator.
 *
 * Rendered as an ordered list inside a `nav` so assistive tech reads it as
 * "step 2 of 4" rather than as four loose numbers, with `aria-current` marking
 * the active step. Completed steps are clickable; steps ahead are not, because
 * jumping forward would skip the validation gate.
 */
export default function StepIndicator({ titles, current, furthestReached, onJump }) {
  return (
    <nav aria-label="Form progress">
      <ol className="step-indicator">
        {titles.map((title, index) => {
          const isComplete = index < current;
          const isActive = index === current;
          const canJump = index <= furthestReached && !isActive;

          return (
            <li className="step" key={title}>
              {index > 0 && <span className={`step-line${isComplete ? ' completed' : ''}`} aria-hidden="true" />}
              <button
                type="button"
                className="step-button"
                onClick={() => canJump && onJump(index)}
                disabled={!canJump}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={`step-number${isActive ? ' active' : ''}${isComplete ? ' completed' : ''}`}
                  aria-hidden="true"
                >
                  {isComplete ? <FiCheck /> : index + 1}
                </span>
                <span className="step-title">
                  <span className="sr-only">Step {index + 1}: </span>
                  {title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
