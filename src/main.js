import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

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

    core.debug(
      `Fetching repository variable with the name ${forceUpdateBuildCountName}...`
    )
    const getRepositoryVariableResponse =
      await octokit.rest.actions.getRepoVariable({
        owner,
        repo,
        name: forceUpdateBuildCountName
      })
    const forceUpdateBuildCount = getRepositoryVariableResponse.data.value

    if (!forceUpdateBuildCount) {
      core.setOutput('force_update_build_count', 0)
      return
    }

    // Make request to get pull requests associated with the commit
    core.debug(`Fetching pull requests for commit ${commitSha}...`)

    let pullRequests = []

    try {
      const getPullRequestsResponse =
        await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
          owner,
          repo,
          commit_sha: commitSha
        })
      // Filter pull requests by label
      pullRequests = getPullRequestsResponse.data
        .filter((pr) => !!pr.merged_at) // only merged pull requests
        .filter((pr) => {
          if (pr.labels.length === 0) {
            return false
          }
          return Boolean(pr.labels.find((prLabel) => prLabel.name === label))
        })
    } catch (err) {
      if (err instanceof Error) {
        core.error(err)
      }
      // If there's an error when fetching the pull requests, set the `force_update_build_count` output to the current value.
      core.setOutput('force_update_build_count', forceUpdateBuildCount)
      return
    }

    core.info(
      `Force update build count: ${forceUpdateBuildCount} (from variable ${forceUpdateBuildCountName})`
    )
    core.info(
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

    try {
      // Update the force update build count variable
      await octokit.rest.actions.updateRepoVariable({
        owner,
        repo,
        name: forceUpdateBuildCountName,
        value: latestForceUpdateBuildCount
      })
    } catch {
      // If there's an error when patching the repository variable, set the `force_update_build_count` output to the current value.
      core.setOutput('force_update_build_count', forceUpdateBuildCount)
      return
    }

    core.setOutput('force_update_build_count', latestForceUpdateBuildCount)
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
    }
    // If there is an error in request setup, fetching repository variable, or computing the updated force build count,
    // then set the ouput to `NaN`.
    core.setOutput('force_update_build_count', NaN)
  }
}
