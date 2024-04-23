const settings = require('../settings');

// get array of categories for post, filtered as specified in settings
module.exports = (post) => {
	if (!post.data.category) {
		return [];
	}

	const categories = post.data.category
		.filter(category => category.$.domain === 'category')
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));

  let result = categories
  	.filter(category => !settings.filter_categories.includes(category))
	.map(category => settings.translateCategory(category));

	if(result.length == 0) console.log("oops")
   return result;
};
