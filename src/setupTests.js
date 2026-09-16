// Loaded automatically by react-scripts before each test file.

// jest-dom's matchers: toBeInTheDocument, toBeDisabled, toHaveTextContent, ...
import '@testing-library/jest-dom';

/**
 * Jest's default per-test timeout is 5 seconds, which is too tight for the
 * integration tests in this project.
 *
 * Those tests drive the whole wizard with simulated typing -- four steps, a file
 * upload, dozens of keystrokes each re-running validation -- and then wait on the
 * real asynchronous submission path. A single one takes around 3.4 seconds on an
 * idle machine, which leaves almost no headroom: under any load (a parallel
 * build, CI sharing a runner) they exceed 5 seconds and fail on timing rather
 * than on behaviour.
 *
 * A flaky suite is worse than a smaller one, because it teaches people to ignore
 * red. The generous ceiling here does not slow down passing tests -- it only
 * changes how long a genuinely stuck test waits before it is reported.
 */
jest.setTimeout(30000);
