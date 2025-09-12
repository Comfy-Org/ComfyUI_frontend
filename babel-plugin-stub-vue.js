module.exports = function() {
  return {
    visitor: {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.endsWith('.vue')) {
          // Replace Vue component imports with a stub
          const specifiers = path.node.specifiers;
          if (specifiers.length > 0) {
            const name = specifiers[0].local.name;
            // Create a simple stub object
            path.replaceWithSourceString(`const ${name} = {};`);
          }
        }
      }
    }
  };
};