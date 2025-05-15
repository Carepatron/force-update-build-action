# Force Update Build GitHub Action

A GitHub Action that increments the force update build count, based on the
Carepatron Main App version.json file, when a commit is associated with a pull
request that has a specific label.

## Usage

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Force Update Build
    id: force-update
    uses: carepatron/force-update-build-action@v1.2.0
    with:
      commit_sha: ${{ github.sha }}
      github_token: ${{ secrets.GITHUB_TOKEN }}
      owner: ${{ github.repository_owner }}
      repo: ${{ github.event.repository.name }}
      # Optional: Filter PRs by label
      label: 'force-update'
      # Optional: Process all PRs regardless of merge status
      # skip_merged_pr_check: 'true'

  - name: Use Force Update Build Count
    run: |
      echo "Force Update Build Count: ${{ steps.force-update.outputs.force_update_build_count }}"
```

## How It Works

1. The action fetches the current `forceUpdateBuildCount` from Carepatron Main
   App's version.json file.
2. It fetches all pull requests associated with the specified commit.
3. It filters only merged pull requests.
4. It filters the pull requests for a specific label (e.g., 'force-update').
5. If at least one labeled PR is found, it increments the force update build
   count.
6. The updated force update build count is provided as an output for use in
   subsequent steps.

## Inputs

| Input                  | Description                                                                                                                                                                   | Required | Default   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| `commit_sha`           | The SHA of the commit to find associated pull requests                                                                                                                        | Yes      | N/A       |
| `github_token`         | GitHub token for API authentication                                                                                                                                           | Yes      | N/A       |
| `owner`                | The owner of the repository                                                                                                                                                   | Yes      | N/A       |
| `repo`                 | The name of the repository                                                                                                                                                    | Yes      | N/A       |
| `label`                | Filter pull requests by label name                                                                                                                                            | No       | `''`      |
| `skip_merged_pr_check` | Skip checking if pull requests are merged. Default behavior is to filter out non-merged pull requests. Set to 'true' to process all pull requests regardless of merge status. | No       | `'false'` |

## Outputs

| Output                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `force_update_build_count` | The updated (or current if not updated) build counter value |

## Behavior Details

- If no pull requests are found for the commit, the current force update build
  count value is returned without incrementing.
- If pull requests are found, but none match the specified label, the current
  force update build count value is returned without incrementing.
- If one or more labeled pull requests are found, the force update build count
  is incremented by 1.
- If the force update build count doesn't exist or is not a number in the
  version.json file, the output will be set to 0.
- If any error occurs during execution, the action won't fail the workflow but
  will output a value of `NaN`.
