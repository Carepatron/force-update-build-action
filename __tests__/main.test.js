/**
 * Unit tests for the action's main functionality, src/main.js
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock for Octokit
const mockOctokitRequest = jest.fn()
const mockOctokit = {
  request: mockOctokitRequest
}

// Mock Octokit constructor
const MockOctokit = jest.fn().mockImplementation(() => mockOctokit)

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@octokit/core', () => {
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

  // Reset mock implementation for Octokit
  mockOctokitRequest.mockReset()
  MockOctokit.mockClear()
})

afterEach(() => {
  jest.resetAllMocks()
})

it('should set output to current count when no PRs associated with commit', async () => {
  // Mock response for get pull requests - empty array
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.resolve({
      data: []
    })
  })

  // Mock response for get repository variable
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.resolve({
      data: {
        value: '42'
      }
    })
  })

  await run()

  // Verify the output was set to current count
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    '42'
  )

  // Verify that the PATCH endpoint was not called
  expect(mockOctokitRequest).toHaveBeenCalledTimes(2)
})

it('should increment count when PRs with label are associated with commit', async () => {
  // Mock response for get pull requests - with labeled PR
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.resolve({
      data: [
        {
          number: 123,
          labels: [{ name: 'force-update' }]
        }
      ]
    })
  })

  // Mock response for get repository variable
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.resolve({
      data: {
        value: '42'
      }
    })
  })

  // Mock response for patch repository variable
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.resolve({
      status: 204
    })
  })

  await run()

  // Verify the output was set to incremented count
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    '43'
  )

  // Verify that the PATCH endpoint was called with correct value
  expect(mockOctokitRequest).toHaveBeenNthCalledWith(
    3,
    'PATCH /repos/{owner}/{repo}/actions/variables/{name}',
    expect.objectContaining({
      owner: 'carepatron',
      repo: 'test-repo',
      name: 'FORCE_UPDATE_BUILD_COUNT',
      value: '43'
    })
  )
})

it('should handle API errors gracefully', async () => {
  // Mock error for get pull requests
  mockOctokitRequest.mockImplementationOnce(() => {
    return Promise.reject(new Error('API error'))
  })

  await run()

  // Verify error was logged
  expect(core.error).toHaveBeenCalled()

  // Verify default output was set
  expect(core.setOutput).toHaveBeenNthCalledWith(
    1,
    'force_update_build_count',
    0
  )
})
