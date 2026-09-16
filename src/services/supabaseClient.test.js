import { describeConfigProblem } from './supabaseClient';

/**
 * These exist because a mistyped environment variable once rendered the whole
 * app as a blank white page: `createClient` throws on a malformed URL, and this
 * module is imported at the top of the tree, so it threw during module
 * evaluation before React could render an error.
 *
 * A configuration mistake has to degrade to "no backend" and say why.
 */
describe('describeConfigProblem', () => {
  it('accepts no configuration at all as a valid mode', () => {
    expect(describeConfigProblem('', '')).toBeNull();
  });

  it('accepts a correct pair', () => {
    expect(
      describeConfigProblem('https://abcdefghijkl.supabase.co', 'eyJhbGciOiJIUzI1NiJ9.abc.def')
    ).toBeNull();
  });

  it('reports a missing half rather than silently doing nothing', () => {
    expect(describeConfigProblem('https://abc.supabase.co', '')).toMatch(/ANON_KEY is missing/);
    expect(describeConfigProblem('', 'eyJabc')).toMatch(/URL is missing/);
  });

  /** The actual mistake that caused the blank page. */
  it('catches a publishable key pasted into the URL variable', () => {
    const problem = describeConfigProblem('sb_publishable_2jaGKujaD_YvhNOAtcZ2fw', 'eyJabc');
    expect(problem).toMatch(/looks like an API key, not a URL/);
    expect(problem).toMatch(/project-ref/);
  });

  it('catches a JWT pasted into the URL variable', () => {
    expect(describeConfigProblem('eyJhbGciOiJIUzI1NiJ9.abc.def', 'eyJabc')).toMatch(
      /looks like an API key/
    );
  });

  it('catches a URL pasted into the key variable', () => {
    expect(
      describeConfigProblem('https://abc.supabase.co', 'https://abc.supabase.co')
    ).toMatch(/looks like a URL, not a key/);
  });

  it('rejects a malformed URL', () => {
    expect(describeConfigProblem('not a url', 'eyJabc')).toMatch(/not a valid URL/);
  });

  it('rejects a non-http protocol', () => {
    expect(describeConfigProblem('ftp://abc.supabase.co', 'eyJabc')).toMatch(/http\(s\) URL/);
  });
});
