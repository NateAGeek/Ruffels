# Ruffels

This is a system that takes in a large sequece of a codebase, and attempts to group the the code systems into 
groups. It keeps track of types, and the type mutation, and the strucure of the codebase being used.

We are going to use the rust backend to better analyze the AST to a codebase, going to start with TypeScript.
The goal is to better understand code changes and codebases at a larger perspective. It is to reduce the shuffling through
all the files and folders, and more interactively review the data structures and the systems at play. 

## Nodes
We need to graph our data structures, and then graph our functions, I would assume functions have dependancies to other functions, and we need to make sure we compare how those functions work.

We also need to properly nest doll the nodes, allowing further review of the codeflow and how the system works. 

## Complexity
Right now we are just going to mess with the graphs, to get a basic understanding of the codebase, however, I do want to find someway to define metrics for complexity. How code being implemented creates complexity and then try to properly guide a LLM to correctly simplify the complexity.

### Handling Changes
We need to also handle diffs, some degree of intergration to git, allowing to view diffs and highlevel reasoning of how a code is changing the complexity of a program.
We also would be nice to highlight some basic metrics of test and coverage, to better understand faults in the codebases. 