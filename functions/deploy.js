const axios = require('axios');

// will fire from a bitbucket webhook (create and update PR)
// this function will get the source branch from PR
// and send a post request to a netlify build hook
// which will trigger a build for the source branch
exports.handler = async function (event, context) {
    try {
        const body = JSON.parse(event.body)
		//get source branch from pr
		const branch = body.pullrequest.source.branch.name;
		if (!branch) {
			throw new Error('Invalid branch');
		}
		// start build for target branch
		const url = `${process.env.BUILD_HOOK_URL}?trigger_branch=${branch}&trigger_title=PR-preview-for-${branch}`;
        await axios.post(url);
        
        return {
            statusCode: 200,
            body: "Deployment started"
        }
	} catch (e) {
		console.log('error', e);
        return { statusCode: 500, body: e.toString() }
	}
}