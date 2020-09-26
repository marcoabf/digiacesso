export default {
  name: "baseTable",
  props: ["title", "record"],
  template: `
  <div>
    <div class="div-table-array-line" >
      <div class="table-col" ><strong> {{title}} </strong></div>
      <div class="table-col" > <slot></slot> </div>
    </div>
  </div>

  `,
};
