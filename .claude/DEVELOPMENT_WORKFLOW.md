# DEVELOPMENT WORKFLOW - READ THIS BEFORE EVERY CHANGE

## CRITICAL: Test Everything Before Telling User It's Ready

### The Rule:
**NEVER tell the user something is "ready" or "fixed" until you have:**
1. **TESTED it** (written and run tests)
2. **VERIFIED it works AS INTENDED** (not just "passes tests", but actually solves the problem)
3. **CONFIRMED no regressions** (didn't break anything else)

### Before Every Feature/Fix:

1. **Write the Code** ✓
2. **Write Automated Tests** ✓
3. **Run the Tests** ✓
4. **Verify Tests Pass** ✓
5. **ONLY THEN** commit and tell user ✓

### Testing Checklist:

- [ ] Created test script for the feature/fix
- [ ] Ran the test script successfully
- [ ] All tests passed
- [ ] Verified no regressions
- [ ] Tested edge cases
- [ ] Committed test script with code changes

### Types of Tests to Write:

**For Backend Changes:**
- Unit tests for functions
- Integration tests for API endpoints
- Database query tests
- Error handling tests

**For Frontend Changes:**
- Component rendering tests
- User flow simulations
- Error state handling
- Edge case scenarios

**For Auth/Security:**
- Error recovery tests
- Token expiration tests
- Session management tests
- Cleanup verification

**For Bug Fixes:**
- Test that reproduces the bug
- Test that verifies the fix
- Test for related edge cases
- Regression test suite

### Test Script Naming Convention:

```
scripts/test-[feature-name].js
```

Examples:
- `scripts/test-signup-flow.js`
- `scripts/test-refresh-token-error.js`
- `scripts/test-recommendation-feed.js`

### What "Tested and Verified" Means:

❌ **NOT Tested:**
- "I think this will work"
- "The code looks correct"
- "It should handle this case"
- "I added error handling"
- "Tests pass" (without verifying actual behavior)

✅ **Actually Tested AND Verified:**
- "I ran the test script and all tests passed"
- "Here are the test results: ✅ PASS"
- "I verified it solves the original problem"
- "I tested the actual user scenario works"
- "I confirmed no side effects or regressions"
- "Test coverage: X/Y cases passing"

### Verification Checklist:

After tests pass, ask yourself:
- [ ] Does this actually solve the user's problem?
- [ ] Did I test the exact scenario the user described?
- [ ] Would this work if I were the user?
- [ ] Did I test edge cases and error conditions?
- [ ] Did I verify nothing else broke?
- [ ] Can I demonstrate this working end-to-end?

**If you can't answer YES to all of these, it's NOT ready.**

### Committing Changes:

**Always commit in this order:**
1. Code changes
2. Test scripts
3. Test results in commit message

**Commit Message Format:**
```
[Feature/Fix]: Brief description

Changes:
- List of changes made

Testing:
- Test script: scripts/test-[name].js
- Results: ✅ ALL TESTS PASSED
  - Test case 1: PASS
  - Test case 2: PASS
  - Test case 3: PASS

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### When You Can Skip Testing:

**ONLY for:**
- Documentation updates (README, comments)
- Code formatting changes (no logic changes)
- Configuration tweaks (with manual verification)

**EVERYTHING ELSE requires tests.**

### Senior Dev Mindset:

Think: "Would I merge this PR without tests?"
- If NO → Write tests
- If YES → Still write tests

The user is trusting you to deliver quality code. Don't break that trust.

---

## REMINDER: This File is Your Contract

Every time you make changes:
1. Read this file
2. Follow the workflow
3. Write tests
4. Run tests
5. Verify tests pass
6. Commit everything
7. THEN tell user it's ready

**No exceptions.**
