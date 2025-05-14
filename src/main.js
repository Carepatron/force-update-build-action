import * as core from '@actions/core'
import { Octokit } from '@octokit/core'

export async function run() {
  try {
    const commitSha = core.getInput('commit_sha')
    const personalAccessToken = core.getInput('personal_access_token')
    const owner = core.getInput('owner')
    const repo = core.getInput('repo')
    const label = core.getInput('label')
    const forceUpdateBuildCountName = core.getInput(
      'force_update_build_count_name'
    )

    core.debug(`Commit SHA: ${commitSha}`)
    core.debug(`Owner: ${owner}`)
    core.debug(`Repo: ${repo}`)
    core.debug(`Label: ${label}`)
    core.debug(`Force Update Build Count Name: ${forceUpdateBuildCountName}`)

    const octokit = new Octokit({
      auth: personalAccessToken
    })

    // Make request to get pull requests associated with the commit
    core.debug(`Fetching pull requests for commit ${commitSha}...`)
    const getPullRequestsResponse = await octokit.request(
      'GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls',
      {
        owner,
        repo,
        commit_sha: commitSha,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    // Filter pull requests by label
    const pullRequests = getPullRequestsResponse.data.filter((pr) => {
      if (pr.labels.length === 0) {
        return false
      }
      return Boolean(pr.labels.find((prLabel) => prLabel.name === label))
    })

    const getRepositoryVariableResponse = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/variables/{name}',
      {
        owner,
        repo,
        name: forceUpdateBuildCountName,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    const forceUpdateBuildCount = getRepositoryVariableResponse.data.value

    if (!forceUpdateBuildCount) {
      core.setOutput('force_update_build_count', 0)
      return
    }

    core.debug(
      `Force update build count: ${forceUpdateBuildCount} (from variable ${forceUpdateBuildCountName})`
    )
    core.debug(
      `Found ${pullRequests.length} pull requests associated with the commit`
    )

    // If there are no pull requests associated with the commit, set the output to current force update build count.
    if (pullRequests.length === 0) {
      core.setOutput('force_update_build_count', forceUpdateBuildCount)
      return
    }

    const latestForceUpdateBuildCount = (
      parseInt(forceUpdateBuildCount) + 1
    ).toString()
    // Update the force update build count variable
    await octokit.request(
      'PATCH /repos/{owner}/{repo}/actions/variables/{name}',
      {
        owner,
        repo,
        name: forceUpdateBuildCountName,
        value: latestForceUpdateBuildCount,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    core.setOutput('force_update_build_count', latestForceUpdateBuildCount)
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
    }

    // Avoid failing the workflow run if there is an error occurring in the action. Instead, set output to 0.
    core.setOutput('force_update_build_count', 0)
  }
}
