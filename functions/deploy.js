const axios = require("axios");

const getBuildURL = (hash, branch) => {
  return `https://api.netlify.com/build_hooks/${hash}?trigger_branch=${branch}&trigger_title=PR-preview-for-${branch}`;
};

// will fire from a bitbucket webhook (create and update PR)
// this function will get the source branch from PR
// and send a post request to a netlify build hook
// which will trigger a build for the source branch
exports.handler = async function (event, context) {
  try {
    const body = JSON.parse(event.body);

    //get repository & source branch from pr
    const repo = body.repository.name;
    const branch = body.pullrequest.source.branch.name;

    if (!repo || !branch) {
      throw new Error("Invalid repo/branch");
    }

    // start build for target branch
    let url = "";

    switch (repo) {
      case process.env.CAP_BITBUCKET_REPOSITORY_NAME:
        url = getBuildURL(process.env.CAP_NETLIFY_BUILD_HASH, branch);
        break;

      case process.env.ECOM_BITBUCKET_REPOSITORY_NAME:
        url = getBuildURL(process.env.ECOM_NETLIFY_BUILD_HASH, branch);
        break;

      case process.env.CAP_NEXTJS_REPOSITORY_NAME:
        url = getBuildURL(process.env.CAP_NEXTJS_NETLIFY_BUILD_HASH, branch);
        break;

      default:
        break;
    }

    await axios.post(url);

    return {
      statusCode: 200,
      body: "Deployment started",
    };
  } catch (e) {
    console.log("error", e);
    return { statusCode: 500, body: e.toString() };
  }
};
