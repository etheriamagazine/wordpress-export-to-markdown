const settings = require('../settings.js');

// get author
module.exports = (post) => {
	// console.log('\nBEGIN POST DATA DUMP ===========================================================\n');
	// console.dir(post, { depth: null });
	// console.log('\nEND POST DATA DUMP =============================================================\n');
	if(!post.data.creator) {
		return [];
	}

	// if(Array.isArray(post.data.creator)) {
	// 	return post.data.creator;
	// }

	// let authors = Array.isArray(post.data.creator) ?
	// 	post.data.creator :
	// 	post.data.creator[0];

	let authors = post.data.creator;

	return authors.map(x => settings.translateAuthor(x));
};
