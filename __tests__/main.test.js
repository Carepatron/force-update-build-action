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

// Mock for global fetch
global.fetch = jest.fn()

// Create mock Octokit client
const mockOctokit = {
  rest: {
    repos: {
      listPullRequestsAssociatedWithCommit:
        mockListPullRequestsAssociatedWithCommit
    }
  }
}

// Mock Octokit constructor
const MockOctokit = jest.fn().mockImplementation(() => mockOctokit)

// Mock fetch Response
const mockResponse = {
  ok: true,
  json: jest.fn()
}

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
  github_token: 'token123',
  owner: 'carepatron',
  repo: 'test-repo',
  label: 'force-update',
  skip_merged_pr_check: 'false'
}

const mockVersion = {
  forceUpdateBuildCount: 42
}

beforeEach(() => {
  // Set the action's inputs as return values from core.getInput().
  core.getInput.mockImplementation((name) => mockInputs[name])
  // Reset fetch mock
  global.fetch.mockReset()
  // Default response for version.json
  global.fetch.mockResolvedValue({
    ...mockResponse,
    json: jest.fn().mockResolvedValue(mockVersion)
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

it('should increment count when PR with label are associated with commit', async () => {
  // Mock response for list pull requests - with labeled PR
  mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
    data: [
      {
        number: 123,
        labels: [{ name: 'force-update' }],
        merged_at: '2011-01-26T19:01:12Z'
      }
    ]
  })

  await run()

  // Verify that fetch was called with the correct URL
  expect(global.fetch).toHaveBeenCalledWith(
    'https://app.carepatron.com/version.json',
    expect.any(Object)
  )

  // Verify the output was set to incremented count
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    mockVersion.forceUpdateBuildCount + 1
  )
})

it('should not increment count for PRs without the specified label', async () => {
  // Mock response for list pull requests - with PR but wrong label
  mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
    data: [
      {
        number: 123,
        labels: [{ name: 'some-other-label' }],
        merged_at: '2011-01-26T19:01:12Z'
      }
    ]
  })

  await run()

  // Verify the output was set to original count (not incremented)
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    mockVersion.forceUpdateBuildCount
  )
})

it('should set the output to current count when no PRs associated with commit', async () => {
  // Mock response for list pull requests - empty array
  mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
    data: []
  })

  await run()

  // Verify the output was set to current count
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    mockVersion.forceUpdateBuildCount
  )
})

it('should set the output to current forceUpdateBuildCount of 0 when it is not defined in version.json', async () => {
  // Mock response for version.json without forceUpdateBuildCount
  global.fetch.mockResolvedValueOnce({
    ...mockResponse,
    json: jest.fn().mockResolvedValue({})
  })

  // Mock response for list pull requests with labeled PR
  mockListPullRequestsAssociatedWithCommit.mockResolvedValue({
    data: [
      {
        number: 123,
        labels: [{ name: 'force-update' }],
        merged_at: '2011-01-26T19:01:12Z'
      }
    ]
  })

  await run()

  // Verify the output was set to 0 when no forceUpdateBuildCount exists
  expect(core.setOutput).toHaveBeenCalledWith('force_update_build_count', 0)
})

it('should set the output to NaN when fetch request fails', async () => {
  // Mock failed fetch
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 404
  })

  await run()

  expect(core.error).toHaveBeenCalled()

  // Verify default output was set
  expect(core.setOutput).toHaveBeenCalledWith('force_update_build_count', NaN)
})

it('should set the output to current count when pull request fetch fails', async () => {
  // Mock error for list pull requests
  mockListPullRequestsAssociatedWithCommit.mockRejectedValueOnce(
    new Error('API error')
  )

  await run()

  expect(core.error).toHaveBeenCalled()

  // Verify current count is used
  expect(core.setOutput).toHaveBeenCalledWith(
    'force_update_build_count',
    mockVersion.forceUpdateBuildCount
  )
})
