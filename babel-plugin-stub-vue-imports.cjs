module.exports = function(babel) {
  const { types: t } = babel;
  
  return {
    visitor: {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        
        // Handle Vue files
        if (source.endsWith('.vue')) {
          const specifiers = path.node.specifiers;
          if (specifiers.length > 0 && specifiers[0].type === 'ImportDefaultSpecifier') {
            const name = specifiers[0].local.name;
            // Replace with a variable declaration
            path.replaceWith(
              t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.identifier(name),
                  t.objectExpression([])
                )
              ])
            );
          }
        }
        // Handle CSS files - just remove the import
        else if (source.endsWith('.css') || source.endsWith('.scss') || source.endsWith('.less')) {
          path.remove();
        }
      }
    }
  };
};