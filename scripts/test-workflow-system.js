/**
 * Test Workflow System
 *
 * Verifies that the development workflow is properly set up:
 * 1. Workflow file exists and is readable
 * 2. CLAUDE.md references the workflow
 * 3. Workflow contains critical testing requirements
 */

const fs = require('fs');
const path = require('path');

function testWorkflowFileExists() {
  console.log('\n📄 Test 1: Workflow File Exists\n');

  const workflowPath = path.join(__dirname, '..', '.claude', 'DEVELOPMENT_WORKFLOW.md');

  if (!fs.existsSync(workflowPath)) {
    console.log('❌ FAIL: Workflow file does not exist');
    return false;
  }

  console.log(`✅ PASS: Workflow file exists at ${workflowPath}`);
  return true;
}

function testWorkflowIsReadable() {
  console.log('\n📖 Test 2: Workflow File is Readable\n');

  const workflowPath = path.join(__dirname, '..', '.claude', 'DEVELOPMENT_WORKFLOW.md');

  try {
    const content = fs.readFileSync(workflowPath, 'utf8');

    if (content.length === 0) {
      console.log('❌ FAIL: Workflow file is empty');
      return false;
    }

    console.log(`✅ PASS: Workflow file is readable (${content.length} bytes)`);
    return true;
  } catch (error) {
    console.log(`❌ FAIL: Cannot read workflow file: ${error.message}`);
    return false;
  }
}

function testWorkflowContainsRequirements() {
  console.log('\n✅ Test 3: Workflow Contains Testing Requirements\n');

  const workflowPath = path.join(__dirname, '..', '.claude', 'DEVELOPMENT_WORKFLOW.md');
  const content = fs.readFileSync(workflowPath, 'utf8');

  const requiredSections = [
    'Test Everything Before Telling User',
    'Write Automated Tests',
    'Run the Tests',
    'Verify Tests Pass',
    'ONLY THEN',
  ];

  let allFound = true;
  requiredSections.forEach(section => {
    if (content.includes(section)) {
      console.log(`✅ Contains: "${section}"`);
    } else {
      console.log(`❌ Missing: "${section}"`);
      allFound = false;
    }
  });

  if (allFound) {
    console.log('\n✅ PASS: All required sections present');
    return true;
  } else {
    console.log('\n❌ FAIL: Missing required sections');
    return false;
  }
}

function testClaudeMdReferencesWorkflow() {
  console.log('\n🔗 Test 4: CLAUDE.md References Workflow\n');

  const claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
  const content = fs.readFileSync(claudeMdPath, 'utf8');

  const hasReference = content.includes('DEVELOPMENT_WORKFLOW.md');
  const hasCriticalSection = content.includes('CRITICAL: READ BEFORE MAKING ANY CHANGES');
  const hasTestingRule = content.includes('NEVER tell the user something is "ready"');

  console.log('References workflow file:', hasReference ? '✅' : '❌');
  console.log('Has CRITICAL section:', hasCriticalSection ? '✅' : '❌');
  console.log('Has testing rule:', hasTestingRule ? '✅' : '❌');

  if (hasReference && hasCriticalSection && hasTestingRule) {
    console.log('\n✅ PASS: CLAUDE.md properly references workflow');
    return true;
  } else {
    console.log('\n❌ FAIL: CLAUDE.md does not properly reference workflow');
    return false;
  }
}

function testWorkflowEnforcement() {
  console.log('\n🔒 Test 5: Workflow Enforcement Rules\n');

  const workflowPath = path.join(__dirname, '..', '.claude', 'DEVELOPMENT_WORKFLOW.md');
  const content = fs.readFileSync(workflowPath, 'utf8');

  const checks = {
    'Has testing checklist': content.includes('Testing Checklist'),
    'Defines test types': content.includes('Types of Tests'),
    'Has commit format': content.includes('Commit Message Format'),
    'States "No exceptions"': content.includes('No exceptions'),
    'Defines test script naming': content.includes('scripts/test-'),
  };

  let allPass = true;
  Object.entries(checks).forEach(([check, passes]) => {
    console.log(`${passes ? '✅' : '❌'} ${check}`);
    if (!passes) allPass = false;
  });

  if (allPass) {
    console.log('\n✅ PASS: Workflow has proper enforcement rules');
    return true;
  } else {
    console.log('\n❌ FAIL: Workflow missing enforcement rules');
    return false;
  }
}

function runAllTests() {
  console.log('\n========================================');
  console.log('  WORKFLOW SYSTEM VERIFICATION');
  console.log('========================================\n');

  const results = {
    'Workflow file exists': testWorkflowFileExists(),
    'Workflow is readable': testWorkflowIsReadable(),
    'Workflow has requirements': testWorkflowContainsRequirements(),
    'CLAUDE.md references workflow': testClaudeMdReferencesWorkflow(),
    'Workflow enforcement rules': testWorkflowEnforcement(),
  };

  console.log('\n========================================');
  console.log('  TEST RESULTS');
  console.log('========================================\n');

  let allPassed = true;
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
    if (!passed) allPassed = false;
  });

  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED\n');
    console.log('Workflow system is properly configured:');
    console.log('  1. Workflow file exists and is readable ✓');
    console.log('  2. CLAUDE.md references workflow prominently ✓');
    console.log('  3. Testing requirements are clearly defined ✓');
    console.log('  4. Enforcement rules are in place ✓');
    console.log('\nClaude will now see this workflow before making changes.\n');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED\n');
    console.log('Workflow system needs fixes before it can be trusted.\n');
    process.exit(1);
  }
}

runAllTests();
