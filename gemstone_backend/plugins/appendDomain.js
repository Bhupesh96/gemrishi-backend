/**
 * Append the domain name to all URLs in the object/array recursively.
 * @param {Object|Array} data - The object or array of data
 * @param {String} domain - The base domain (e.g., https://api.example.com)
 * @param {Array} fields - List of field names that should be prefixed with the domain
 */
function appendDomainPluginOld(schema, options = {}) {
	const domain = options.domain || process.env.DOMAIN_NAME;
	const fields = options.fields || ["url"];
	// console.log(domain, fields);

	function transform(doc, ret) {
		if (!ret) return ret;
		const domain = options.domain || process.env.DOMAIN_NAME; // added again beacuse out of this function this dont work

		function addDomain(obj) {
			for (const key in obj) {
				if (!obj[key]) continue;

				if (typeof obj[key] === "object") {
					addDomain(obj[key]);
					// console.log(obj[key]);
				} else if (fields.includes(key) && typeof obj[key] === "string" && obj[key].startsWith("/")) {
					obj[key] = `${domain}${obj[key]}`;
				}
			}
		}

		addDomain(ret);
		return ret;
	}

	if (!schema.options.toJSON) schema.options.toJSON = {};
	if (!schema.options.toObject) schema.options.toObject = {};

	schema.options.toJSON.transform = transform;
	schema.options.toObject.transform = transform;
}


/**
 * Mongoose plugin to recursively append a domain to specified URL fields.
 * Works for both standard queries (via toJSON) and aggregation queries.
 */
function appendDomainPlugin(schema, options = {}) {
	const fields = options.fields || ["url"];

	// Helper function to recursively find and prefix URLs
	function addDomain(obj, domain) {
		for (const key in obj) {
			if (!obj[key]) continue;

			if (typeof obj[key] === "object") {
				addDomain(obj[key], domain);
			} else if (fields.includes(key) && typeof obj[key] === "string" && obj[key].startsWith("/")) {
				obj[key] = `${domain}${obj[key]}`;
			}
		}
	}

	// 1. For standard queries (find, findOne, etc.) using toJSON transform
	const transform = (doc, ret, opts) => {
		if (!ret) return ret;
		// The domain is passed via options when calling toJSON(), e.g. doc.toJSON({ domain: '...' })
		// This is not standard, so we will rely on the aggregate approach primarily.
		// For consistency, we will let the aggregate hook handle it.
		// This part is kept for potential backward compatibility if you use it elsewhere.
		const domain = opts.domain || process.env.DOMAIN_NAME;
		if (domain) {
			addDomain(ret, domain);
		}
		return ret;
	};

	schema.set('toJSON', { transform });

	// 2. For aggregation queries
	schema.post('aggregate', function (results, next) {
		// The domain must be passed in the aggregation options
		if (this.options && Array.isArray(results)) {
			const domain = options.domain || process.env.DOMAIN_NAME;
			results.forEach(result => {
				addDomain(result, domain);
			});
		}
		next();
	});
}

export default appendDomainPlugin;
