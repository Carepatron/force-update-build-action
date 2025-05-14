# Force Update Build GitHub Action

A GitHub Action that increments a repository variable when a commit is
associated with a pull request that has a specific label.

## Usage

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4

  - name: Force Update Build
    id: force-update
    uses: carepatron/force-update-build-action@v1.0.0
    with:
      commit_sha: ${{ github.sha }}
      personal_access_token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
      owner: ${{ github.repository_owner }}
      repo: ${{ github.event.repository.name }}
      # Optional: Filter PRs by label
      label: 'force-update'
      # Optional: Name of the repository variable to increment
      force_update_build_count_name: 'FORCE_UPDATE_BUILD_COUNT'

  - name: Use Force Update Build Count
    run: |
      echo "Force Update Build Count: ${{ steps.force-update.outputs.force_update_build_count }}"
```

## How It Works

1. The action fetches all pull requests associated with the specified commit
2. It filters these pull requests for a specific label (e.g., 'force-update')
3. If at least one labeled PR is found, it increments a repository variable
4. The updated counter value is provided as an output for use in subsequent
   steps

## Inputs

| Input                           | Description                                            | Required | Default                      |
| ------------------------------- | ------------------------------------------------------ | -------- | ---------------------------- |
| `commit_sha`                    | The SHA of the commit to find associated pull requests | Yes      | N/A                          |
| `personal_access_token`         | Personal access token for GitHub API authentication    | Yes      | N/A                          |
| `owner`                         | The owner of the repository                            | Yes      | N/A                          |
| `repo`                          | The name of the repository                             | Yes      | N/A                          |
| `label`                         | Filter pull requests by label name                     | No       | `''`                         |
| `force_update_build_count_name` | Name of the repository variable to increment           | No       | `'FORCE_UPDATE_BUILD_COUNT'` |

## Outputs

| Output                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `force_update_build_count` | The updated (or current if not updated) build counter value |

## Behavior Details

- If no pull requests are found for the commit, the current build count value is
  returned without incrementing.
- If pull requests are found, but none match the specified label, the current
  build count value is returned without incrementing.
- If one or more labeled pull requests are found, the build count is incremented
  by 1.
- If the repository variable doesn't exist or has an empty value, the output
  will be set to 0.
- If any error occurs during execution, the action won't fail the workflow but
  will output a value of 0.

## Prerequisites

Before using this action, you must:

1. Create a repository variable named `FORCE_UPDATE_BUILD_COUNT` (or your custom
   name) with a numeric value
2. Ensure your personal access token has proper permissions to:
   - Read and write repository variables (`repo` scope)
