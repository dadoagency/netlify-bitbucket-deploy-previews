const axios = require('axios');
const NetlifyAPI = require('netlify');
const netlifyClient = new NetlifyAPI(process.env.NETLIFY_API_TOKEN);


// fires when the netlify deployment is complete
// triggered from netlify outgoing webhook notification for successful deploy
// this function should:
// 1: take the siteID from the request
// 2: fetch site details from netlify API using siteID
// 3. get the repo URL from the response of 2
// 4. use repo URL to query BB API for pull requests
// 5 if there are PRs - add comments with deploy URL
exports.handler = async function (event, context) {
    try {
        const body = JSON.parse(event.body)
		console.log(body);
		// 1 get site id
		const siteId = body.site_id;
		// 2 get site details
		const siteDetails = await netlifyClient.getSite({ site_id: siteId });
		// 3 get repo url
		const repoUrl = siteDetails.build_settings.repo_url;
		// 4 get pull requests
		const repoName = repoUrl.split('https://bitbucket.org/')[1];
		const bitbucketAPIBaseURL = `https://api.bitbucket.org/2.0/repositories/${repoName}`;
		const bitbucketClient = axios.create({
			baseURL: bitbucketAPIBaseURL,
			auth: {
				username: process.env.BITBUCKET_USER,
				password: process.env.BITBUCKET_PASS,
			},
		});

		const pullRequests = await bitbucketClient.get(
			`/pullrequests?q=source.branch.name="${body.branch}" and state="OPEN"`
		);

		// 5 - add comment with deploy url for each pr
		const buildID = body.id;
		const name = body.name;
		const buildURL = `https://${buildID}--${name}.netlify.app`;
		console.log('build url', buildURL)
		if (pullRequests.data.size > 0) {
			const commentRequests = pullRequests.data.values.map(({ id }) => {
				return bitbucketClient.post(`/pullrequests/${id}/comments`, {
                     content: { raw: `preview URL [${buildURL}](${buildURL})` } ,
				});
			});

			await Promise.all(commentRequests);
            return { statusCode: 200, body: "comments added" }
		}

		return { statusCode: 400, body: `No PRs found for branch ${body.branch}` };
        
	} catch (e) {
		return { statusCode: 500, body: e.toString() };
	}
};
