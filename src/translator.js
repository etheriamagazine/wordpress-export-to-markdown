const turndown = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

function initTurndownService() {
	const turndownService = new turndown({
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced'
	});

	turndownService.use(turndownPluginGfm.tables);

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	// turndownService.addRule('script', {
	// 	filter: 'script',
	// 	replacement: (content, node) => {
	// 		let before = '\n\n';
	// 		if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
	// 			// keep twitter and codepen <script> tags snug with the element above them
	// 			before = '\n';
	// 		}
	// 		const html = node.outerHTML.replace('async=""', 'async');
	// 		return before + html + '\n\n';
	// 	}
	// });

	// remove scripts
	turndownService.remove('script');

	// iframe boolean attributes do not need to be set to empty string
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			if(/maps/.test(node.outerHTML) == false) {
				return '\n\n<!--\n' + node.outerHTML + '\n-->\n\n';
			}
			const html = node.outerHTML
				.replace('allowfullscreen=""', 'allowfullscreen')
				.replace('allowpaymentrequest=""', 'allowpaymentrequest');
			return '\n\n' + html + '\n\n';
		}
	});

	// GFT sanitize posts that use headings as first paragraph
	turndownService.addRule('sanitize_headings_as_summary', {
		filter: node => {
			let isHeadingAsLeading =
				["H4", "H5", "H6"].includes(node.tagName)
				&& !node.previousElementSibling
				&& node.parentNode?.tagName == "X-TURNDOWN";

			return isHeadingAsLeading;
		},
		replacement: function (content, node) {
			// treat as paragraph
			return '\n\n' + content + '\n\n'
		}
	});

	// sanitize posts with strong in first paragraph
	turndownService.addRule('sanitize_strong_as_summary', {
		filter: node => {
			let container = node.parentNode || node;

			let isStrongAsLeading =
				node.tagName == "STRONG"
				&& !container.previousElementSibling
				&& container.parentNode?.tagName == "X-TURNDOWN";

			return isStrongAsLeading;
		},
		replacement: function (content, node) {
			// treat as paragraph
			return '\n\n' + content + '\n\n'
		}
	});

	// extract images and figcaption in a single markdown image syntax
	//  [alt](url "title")
	turndownService.addRule('image_and_captions', {
		filter: 'img',

		replacement: function (content, node) {
			var alt = cleanAttribute(node.getAttribute('alt'))
			var src = node.getAttribute('src') || ''
			var nextElementSibling = node.nextElementSibling
			var figcaption = nextElementSibling?.tagName == "FIGCAPTION" ?
				nextElementSibling.textContent : '';

			var title = figcaption || cleanAttribute(node.getAttribute('title'))
			var titlePart = title ? ' "' + title + '"' : ''
			return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
		}

	});

	turndownService.addRule('remove_figcaption', {
		filter: 'figcaption',
		replacement: (content, node) => {
			// extra newlines are necessary for markdown and HTML to render correctly together
			//return '\n\n<figcaption>\n\n' + content + '\n\n</figcaption>\n\n';
			return '';
		}
	});

	turndownService.addRule('paragraph_refwlo', {
		filter: 'p',
		replacement: function (content) {
			return '\n\n' + wordWrap(content, 90) + '\n\n'
		}
	});

	function wordWrap(text, maxChars = 80) {
		let words = text.split(/\s/);

		let [lastLine, newLines] = words.reduce(([currLine, acc], word) => {
			if (word !== "") {
				if (currLine.length >= maxChars || (word[0] !== "[" && currLine.length + word.length + 1 >= maxChars)) {
					acc.push(currLine);
					currLine = ""
				}

				let spaces = " ";
				currLine = currLine.concat(word).concat(spaces);
			}
			return [currLine, acc];

		}, ["", []]);

		// final line
		if (lastLine.length > 0) {
			newLines.push(lastLine);
		}

		return newLines.join("\n");
	}


	// function reflow(text, maxChars = 80) {
	// 	let lines = [];
	// 	let words = text.split(/\s/);
	// 	let curLine = words.reduce(
	// 		(lines, word) => {
	// 			let curLine = lines.at(0);
	// 			if(curLine.length >= maxChars) {
	// 				lines.push(curLine);
	// 				curLine = "";
	// 			}
	// 		},
	// 		[""]
	// 	)

	// 	words.forEach((word, i) => {
	// 		if (word !== "") {

	// 			// if the current line length is already longer than the max length, push it to the new lines array
	// 			// OR if our word does NOT start with a left square bracket (i.e. is not a .md hyperlink) AND
	// 			// if adding it and a space would make the line longer than the max length, also push it to the new lines array
	// 			if (curLine.length >= curMaxLineLength || (word[0] != "[" && curLine.length + 1 + word.length >= curMaxLineLength)) {
	// 				newLines.push(curLine.replace(/\s*$/, ''));  //remove trailing whitespace
	// 				curLine = sei.indents.otherLines;
	// 			} 

	// 			let spaces = " ";
	// 			if (listStart && i == 0) {
	// 				spaces = spacesAfterListMarker;
	// 			} else if (word.match(/[.!?]"?$/)) {
	// 				spaces = spaceBetweenSentences;
	// 			}
	// 			curLine = curLine.concat(word).concat(spaces);
	// 		}
	// 	});
	// }


	function cleanAttribute(attribute) {
		return attribute ? attribute.replace(/(\n+\s*)+/g, '\n').trim() : ''
	}

	// convert <pre> into a code block with language when appropriate
	turndownService.addRule('pre', {
		filter: node => {
			// a <pre> with <code> inside will already render nicely, so don't interfere
			return node.nodeName === 'PRE' && !node.querySelector('code');
		},
		replacement: (content, node) => {
			const language = node.getAttribute('data-wetm-language') || '';
			return '\n\n```' + language + '\n' + node.textContent + '\n```\n\n';
		}
	});

	return turndownService;
}

function getPostContent(postData, turndownService, config) {
	let content = postData.encoded[0];

	// insert an empty div element between double line breaks
	// this nifty trick causes turndown to keep adjacent paragraphs separated
	// without mucking up content inside of other elements (like <code> blocks)
	content = content.replace(/(\r?\n){2}/g, '\n<div></div>\n');

	if (config.saveScrapedImages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^/"]+\.(?:gif|jpe?g|png))("[^>]*>)/gi, '$1images/$2$3');
	}

	// preserve "more" separator, max one per post, optionally with custom label
	// by escaping angle brackets (will be unescaped during turndown conversion)
	content = content.replace(/<(!--more( .*)?--)>/, '&lt;$1&gt;');

	// some WordPress plugins specify a code language in an HTML comment above a
	// <pre> block, save it to a data attribute so the "pre" rule can use it
	content = content.replace(/(<!-- wp:.+? \{"language":"(.+?)"\} -->\r?\n<pre )/g, '$1data-wetm-language="$2" ');

	// use turndown to convert HTML to Markdown
	content = turndownService.turndown(content);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
