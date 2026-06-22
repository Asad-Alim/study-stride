const chunkText = (text, chunkSize = 1500) => {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, i) => ({ pageNumber: i + 1, content }));
};

module.exports = { chunkText };