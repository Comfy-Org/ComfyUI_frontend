module.exports = function(babel) {
  const { types: t } = babel;

  return {
    visitor: {
      Program(path, state) {
        // Get options from plugin configuration
        const opts = state.opts || {};
        const filenamePattern = opts.filenamePattern || DIE('filenamePattern option is required');
        const setupFile = opts.setupFile || DIE('setupFile option is required');

        // Only inject the setup for matching test files
        if (state.filename?.match(filenamePattern)) {
          // Create an import statement for the setup file
          const importDeclaration = t.importDeclaration(
            [],
            t.stringLiteral(setupFile)
          );

          // Insert the import at the beginning of the file
          path.node.body.unshift(importDeclaration);
        }
      }
    }
  };
};

function DIE(msg) {
  throw new Error(msg);
}