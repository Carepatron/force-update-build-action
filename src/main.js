import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

export async function run() {
  try {
    const commitSha = core.getInput('commit_sha')
    const githubToken = core.getInput('github_token')
    const owner = core.getInput('owner')
    const repo = core.getInput('repo')
    const label = core.getInput('label')
    const skipMergedPrCheck =
      core.getInput('skip_merged_pr_check').toLowerCase() === 'true'

    core.debug(`Commit SHA: ${commitSha}`)
    core.debug(`Owner: ${owner}`)
    core.debug(`Repo: ${repo}`)
    core.debug(`Label: ${label}`)
    core.debug(`Skip Merged PR Check: ${skipMergedPrCheck}`)

    const octokit = new Octokit({
      auth: githubToken
    })

    core.debug(`Fetching Carepatron Main App version.json...`)

    const versionJsonResponse = await fetch(
      'https://app.carepatron.com/version.json',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Referer: 'https://app.carepatron.com/'
        }
      }
    )

    if (!versionJsonResponse.ok) {
      throw new Error(
        `Error fetching version.json. Status: ${versionJsonResponse.status}`
      )
    }

    const version = await versionJsonResponse.json()

    const forceUpdateBuildCount =
      typeof version.forceUpdateBuildCount === 'number'
        ? version.forceUpdateBuildCount
        : 0

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
        .filter((pr) => {
          if (skipMergedPrCheck) {
            return true // include all pull requests if skip check is enabled.
          }
          return !!pr.merged_at
        }) // only include merged pull requests
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
      `Found ${pullRequests.length} pull requests associated with the commit`
    )

    // If there are no pull requests associated with the commit, set the output to current force update build count.
    if (pullRequests.length === 0) {
      core.setOutput('force_update_build_count', forceUpdateBuildCount)
      return
    }

    const latestForceUpdateBuildCount = forceUpdateBuildCount + 1

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
