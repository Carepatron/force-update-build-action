/* eslint-disable jest/no-disabled-tests */
/**
 * Unit tests for the action's main functionality, src/main.js
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock for Octokit REST API methods
const mockListPullRequestsAssociatedWithCommit = jest.fn()
const mockGetRepoVariable = jest.fn()
const mockUpdateRepoVariable = jest.fn()

// Create mock Octokit client
const mockOctokit = {
	rest: {
		repos: {
			listPullRequestsAssociatedWithCommit:
				mockListPullRequestsAssociatedWithCommit
		},
		actions: {
			getRepoVariable: mockGetRepoVariable,
			updateRepoVariable: mockUpdateRepoVariable
		}
	}
}

// Mock Octokit constructor
const MockOctokit = jest.fn().mockImplementation(() => mockOctokit)

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@octokit/rest', () => {
	return {
		Octokit: MockOctokit
	}
})

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

const mockInputs = {
	commit_sha: 'abc123',
	personal_access_token: 'token123',
	owner: 'carepatron',
	repo: 'test-repo',
	label: 'force-update',
	force_update_build_count_name: 'FORCE_UPDATE_BUILD_COUNT'
}

beforeEach(() => {
	// Set the action's inputs as return values from core.getInput().
	core.getInput.mockImplementation((name) => mockInputs[name])
})

afterEach(() => {
	jest.resetAllMocks()
})

it('should increment count when PRs with label are associated with commit', async () => {
	// Mock response for list pull requests - with labeled PR
	mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
		data: [
			{
				number: 123,
				labels: [{ name: 'force-update' }]
			}
		]
	})

	// Mock response for get repository variable
	mockGetRepoVariable.mockResolvedValue({
		data: {
			value: '42'
		}
	})

	// Mock response for update repository variable
	mockUpdateRepoVariable.mockResolvedValue({
		status: 204
	})

	await run()

	// Verify the output was set to incremented count
	expect(core.setOutput).toHaveBeenNthCalledWith(
		1,
		'force_update_build_count',
		'43'
	)

	// Verify that the update variable endpoint was called with correct value
	expect(mockUpdateRepoVariable).toHaveBeenCalledWith(
		expect.objectContaining({
			owner: 'carepatron',
			repo: 'test-repo',
			name: 'FORCE_UPDATE_BUILD_COUNT',
			value: '43'
		})
	)
})

it.skip('should not increment count for PRs without the specified label', async () => {
	// Mock response for list pull requests - with PR but wrong label
	mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
		data: [
			{
				number: 123,
				labels: [{ name: 'some-other-label' }]
			}
		]
	})

	// Mock response for get repository variable
	mockGetRepoVariable.mockResolvedValue({
		data: {
			value: '42'
		}
	})

	await run()

	// Verify the output was set to original count (not incremented)
	expect(core.setOutput).toHaveBeenNthCalledWith(
		1,
		'force_update_build_count',
		'42'
	)

	// Verify that the update variable endpoint was not called
	expect(mockUpdateRepoVariable).not.toHaveBeenCalled()
})

it.skip('should set the output to current count when no PRs associated with commit', async () => {
	// Mock response for list pull requests - empty array
	mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
		data: []
	})

	// Mock response for get repository variable
	mockGetRepoVariable.mockResolvedValue({
		data: {
			value: '42'
		}
	})

	await run()

	// Verify the output was set to current count
	expect(core.setOutput).toHaveBeenNthCalledWith(
		1,
		'force_update_build_count',
		'42'
	)

	// Verify that the update variable endpoint was not called
	expect(mockUpdateRepoVariable).not.toHaveBeenCalled()
})

it('should set the output to NaN when repository variable is not found', async () => {
	// Mock response for get repository variable with falsy value
	mockGetRepoVariable.mockResolvedValue(new Error('API Error'))

	await run()

	expect(core.error).toHaveBeenCalled()

	// Verify default output was set
	expect(core.setOutput).toHaveBeenCalledWith('force_update_build_count', NaN)
})

it('should set the output to NaN when patching repository variable encounter an error', async () => {
	// Mock error for list pull requests
	mockUpdateRepoVariable.mockRejectedValueOnce(new Error('API error'))

	await run()

	expect(core.error).toHaveBeenCalled()

	// Verify default output was set
	expect(core.setOutput).toHaveBeenCalledWith('force_update_build_count', NaN)
})
