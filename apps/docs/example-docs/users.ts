interface User {
  name: string;
  age: number;
  email: string;
}

const users: User[] = [
  { name: "Alice", age: 30, email: "alice@example.com" },
  { name: "Bob", age: 25, email: "bob@example.com" },
];

function getUsersByAge(users: User[], minAge: number): User[] {
  return users.filter((user) => user.age >= minAge);
}

const adults = getUsersByAge(users, 18);
console.log("Adults:", adults);

// Output the result to the page
document.body.innerHTML = `
  <h2>Users (18+)</h2>
  <ul>
    ${adults.map((user) => `<li>${user.name} (${user.age})</li>`).join("")}
  </ul>
`;
