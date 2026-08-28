using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Owlia.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSpeechPercentage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "SpeechPercentage",
                table: "Summaries",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SpeechPercentage",
                table: "Summaries");
        }
    }
}
